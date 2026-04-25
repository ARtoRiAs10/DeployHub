'use strict';
const path         = require('path');
const fs           = require('fs-extra');
const { execSync } = require('child_process');
const simpleGit    = require('simple-git');
const tar          = require('tar-fs');
const { deploymentQueue }                       = require('../queue/deploymentQueue');
const { prisma }                                = require('../utils/prisma');
const { detect }                                = require('../services/detector');
const { generateDockerfile }                    = require('../services/dockerfileGenerator');
const { buildDockerImage, cleanup, docker }     = require('../services/dockerService');
const { uploadDirectoryToS3, getDeploymentUrl } = require('../services/s3Service');
const { deployBackend }                         = require('../services/ec2Service');
const { logger }                                = require('../utils/logger');

const WORK_DIR = '/tmp/deployhub-builds';

deploymentQueue.process('deploy', 1, async (job) => {
  const {
    deploymentId, source, repoUrl, zipPath, branch,
    framework: forcedFramework, buildCommand: forcedBuild, outputDir: forcedOutputDir,
    nodeVersion, envVars,
    projectSubDir: forcedSubDir,
  } = job.data;

  let buildLog = '';
  const log = (msg) => {
    const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
    buildLog += line + '\n';
    logger.debug(`[${deploymentId}] ${line}`);
    job.progress(buildLog.length);
  };

  const repoDir = path.join(WORK_DIR, deploymentId);

  try {
    await prisma.deployment.update({ where:{ id: deploymentId }, data:{ status:'BUILDING', buildLog:'' } });

    // ── Step 1: Get source ────────────────────────────────────────────────
    await fs.ensureDir(repoDir);
    log('📦 Preparing source code...');

    if (source === 'GITHUB') {
      log(`🔗 Cloning ${repoUrl} (branch: ${branch||'main'})...`);
      await simpleGit().clone(repoUrl, repoDir, ['--depth=1', `--branch=${branch||'main'}`]);
      const gitLog = await simpleGit(repoDir).log({ maxCount:1 });
      if (gitLog.latest) {
        await prisma.deployment.update({ where:{ id:deploymentId }, data:{
          commitHash: gitLog.latest.hash.slice(0,7), commitMsg: gitLog.latest.message,
        }});
      }
    } else if (source === 'ZIP') {
      log('📂 Extracting ZIP...');
      execSync(`unzip -q "${zipPath}" -d "${repoDir}" || true`);
      const entries = await fs.readdir(repoDir);
      if (entries.length === 1) {
        const nested = path.join(repoDir, entries[0]);
        if ((await fs.stat(nested)).isDirectory()) {
          const tmp = repoDir + '_tmp';
          await fs.move(nested, tmp); await fs.remove(repoDir); await fs.move(tmp, repoDir);
        }
      }
      await fs.remove(zipPath).catch(() => {});
    }
    log('✓ Source ready');

    // ── Step 2: Resolve scan directory ────────────────────────────────────
    let scanDir = repoDir;
    let manualSubDir = null;
    if (forcedSubDir && forcedSubDir.trim() !== '') {
      const candidate = path.join(repoDir, forcedSubDir.trim());
      if (await fs.pathExists(candidate)) {
        scanDir      = candidate;
        manualSubDir = forcedSubDir.trim();
        log(`📂 Using specified subdirectory: ${forcedSubDir}`);
      } else {
        log(`⚠️  Subdirectory "${forcedSubDir}" not found — falling back to auto-detection`);
      }
    }

    // ── Step 3: Detect framework ──────────────────────────────────────────
    log('🔍 Detecting framework...');
    const detected = await detect(scanDir);

    const framework    = forcedFramework || detected.framework;
    const buildCommand = forcedBuild     || detected.buildCommand;
    const outputDir    = forcedOutputDir || detected.outputDir;
    const entryPoint   = detected.entryPoint;
    const startCommand = detected.startCommand;
    const port         = detected.port || inferPort(framework);
    // goMainPkg: resolved by curated.js — the exact sub-package path containing
    // `package main` (e.g. "cmd"). Passed to dockerfileGenerator so the Go
    // template builds exactly the right package instead of using ./... or .
    const goMainPkg    = detected.goMainPkg || null;

    // FIX: detected.isBackend=true is always authoritative.
    // Previously, job.data.isBackend (which defaults to false from the project DB)
    // silently overrode detected.isBackend=true, causing backend projects (Go, Rust,
    // Flask, etc.) to be incorrectly routed to S3 instead of EC2.
    // Rule: if the detector says it's a backend → it's a backend, full stop.
    // The user-supplied flag only matters when the detector says frontend (false).
    const isBackend = detected.isBackend === true
      ? true
      : (job.data.isBackend != null ? Boolean(job.data.isBackend) : false);

    const buildDir = detected.projectRoot || scanDir;

    const resolvedSubDir = manualSubDir
      || (buildDir !== repoDir ? path.relative(repoDir, buildDir) : null);

    if (buildDir !== repoDir) {
      log(`📂 Project root resolved to: ${path.relative(repoDir, buildDir)}`);
    }

    log(`🔍 Framework: ${framework} (via ${detected.detectionMethod})`);
    log(`📋 Build command: ${buildCommand || 'none'}`);
    log(`📁 Output directory: ${outputDir}`);
    log(`🏷️  Deploy target: ${isBackend ? 'EC2 (dynamic)' : 'S3 (static)'}`);

    // ── Step 4: Generate Dockerfile ───────────────────────────────────────
    if (!detected.hasDockerfile) {
      const result = await generateDockerfile(buildDir, {
        framework, buildCommand, outputDir,
        nodeVersion: nodeVersion || detected.nodeVersion || '20',
        entryPoint, startCommand, port, goMainPkg,
      });
      if (result.generated) log(`🐳 Dockerfile generated for "${framework}"`);
    } else {
      log('🐳 Using existing Dockerfile');
    }

    // ── Step 5: Build Docker image ────────────────────────────────────────
    const imageTag = `deployhub-build-${deploymentId}`.toLowerCase();
    log(`🔨 Building Docker image (${imageTag})...`);
    await buildDockerImage(buildDir, imageTag, log);
    log('✓ Docker image built');

    // ── Step 6a: BACKEND → ECR + EC2 ─────────────────────────────────────
    if (isBackend) {
      log('🖥️  Backend — deploying to EC2...');
      const { backendUrl, ecrImageUri } = await deployBackend({
        deploymentId, localImageTag: imageTag, port, envVars: envVars||{}, log,
      });
      await cleanup(null, imageTag);
      await fs.remove(repoDir).catch(() => {});
      await prisma.deployment.update({ where:{ id:deploymentId }, data:{
        status:'SUCCESS', previewUrl:backendUrl, s3Key:null, ecrImageUri, buildLog,
        finishedAt:new Date(), framework, isBackend:true,
        detectionMethod: detected.detectionMethod, projectSubDir: resolvedSubDir,
      }});
      log(`✅ EC2 deployment live: ${backendUrl}`);
      return { success:true, backendUrl };
    }

    // ── Step 6b: FRONTEND → extract + S3 ─────────────────────────────────
    log('🌐 Frontend — extracting static build for S3...');
    const outputPath = path.join(WORK_DIR, `${deploymentId}-output`);
    await fs.ensureDir(outputPath);
    const envArray   = Object.entries(envVars||{}).map(([k,v]) => `${k}=${v}`);
    const container  = await docker.createContainer({ Image:imageTag, Cmd:['sh','-c','echo done'], Env:envArray });
    await container.start();

    const containerOutputDir = resolveContainerOutputDir(framework, outputDir);
    try {
      const tarStream = await new Promise((res, rej) => {
        container.getArchive({ path: containerOutputDir }, (err, stream) => err ? rej(err) : res(stream));
      });
      await new Promise((res, rej) => {
        const extract = tar.extract(outputPath);
        tarStream.pipe(extract);
        extract.on('finish', res); extract.on('error', rej);
      });
    } catch (e) {
      log(`⚠️  Could not extract ${containerOutputDir}, falling back to build dir`);
      await fs.copy(buildDir, outputPath, { overwrite:true });
    }

    await container.wait().catch(() => {});
    await cleanup(container, imageTag);
    log('✓ Container cleaned up');
    log('☁️  Uploading to S3...');

    let uploadDir = outputPath;
    const outputEntries = await fs.readdir(outputPath);
    if (outputEntries.length === 1) {
      const possible = path.join(outputPath, outputEntries[0]);
      if ((await fs.stat(possible)).isDirectory()) uploadDir = possible;
    }

    const { prefix } = await uploadDirectoryToS3(uploadDir, deploymentId, log);
    const previewUrl  = getDeploymentUrl(deploymentId);

    await prisma.deployment.update({ where:{ id:deploymentId }, data:{
      status:'SUCCESS', previewUrl, s3Key:prefix, buildLog, finishedAt:new Date(),
      framework, isBackend:false,
      detectionMethod: detected.detectionMethod, projectSubDir: resolvedSubDir,
    }});
    await fs.remove(repoDir).catch(() => {});
    await fs.remove(outputPath).catch(() => {});
    log(`✅ S3 deployment live: ${previewUrl}`);
    return { success:true, previewUrl };

  } catch (err) {
    log(`❌ Build failed: ${err.message}`);
    logger.error(`Deployment ${deploymentId} failed:`, err);
    await prisma.deployment.update({ where:{ id:deploymentId }, data:{
      status:'FAILED', errorMsg:err.message, buildLog, finishedAt:new Date(),
    }}).catch(() => {});
    await fs.remove(repoDir).catch(() => {});
    throw err;
  }
});

function resolveContainerOutputDir(framework, outputDir) {
  // nginx-based static frameworks: built files are copied to nginx's html dir
  const nginxBased = new Set(['vite','cra','gatsby','astro','sveltekit-static','static']);
  if (nginxBased.has(framework)) return '/usr/share/nginx/html';
  // nextjs/nuxt are now isBackend=true and go to EC2, so this path is never hit for them.
  // Kept as a safety fallback: if somehow reached, extract from /app (standalone root).
  if (framework === 'nextjs') return '/app';
  if (framework === 'nuxt')   return '/app';
  return outputDir === '.' ? '/app' : `/app/${outputDir}`;
}

function inferPort(framework) {
  const ports = {
    'node-backend':3000, node:3000, nextjs:3000, nuxt:3000, sveltekit:3000,
    fastapi:8000, flask:8000, django:8000, python:8000,
    go:8080, rust:8080, php:80, docker:3000,
  };
  return ports[framework] || 3000;
}

logger.info('🚀 Deployment worker started (FIFO, concurrency: 1)');
