const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const simpleGit = require('simple-git');
const tar = require('tar-fs');
const { deploymentQueue } = require('../queue/deploymentQueue');
const { prisma } = require('../utils/prisma');
const { detectFramework } = require('../services/frameworkDetector');
const { generateDockerfile } = require('../services/dockerfileGenerator');
const { buildDockerImage, runBuildContainer, cleanup, docker } = require('../services/dockerService');
const { uploadDirectoryToS3, getDeploymentUrl } = require('../services/s3Service');
const { logger } = require('../utils/logger');

const WORK_DIR = '/tmp/deployhub-builds';

// Process jobs one at a time (FIFO)
deploymentQueue.process('deploy', 1, async (job) => {
  const { deploymentId, source, repoUrl, zipPath, branch, framework: forcedFramework,
    buildCommand: forcedBuild, outputDir: forcedOutputDir, nodeVersion, envVars } = job.data;

  let buildLog = '';
  const log = (msg) => {
    const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
    buildLog += line + '\n';
    logger.debug(`[${deploymentId}] ${line}`);
    job.progress(buildLog.length);
  };

  const buildDir = path.join(WORK_DIR, deploymentId);

  try {
    // Mark as BUILDING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'BUILDING', buildLog: '' },
    });

    // Step 1: Get source code
    await fs.ensureDir(buildDir);
    log('📦 Preparing source code...');

    if (source === 'GITHUB') {
      log(`🔗 Cloning ${repoUrl} (branch: ${branch || 'main'})...`);
      const git = simpleGit();
      await git.clone(repoUrl, buildDir, ['--depth=1', `--branch=${branch || 'main'}`]);

      // Get commit info
      const gitLocal = simpleGit(buildDir);
      const log_ = await gitLocal.log({ maxCount: 1 });
      const latestCommit = log_.latest;
      if (latestCommit) {
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            commitHash: latestCommit.hash.slice(0, 7),
            commitMsg: latestCommit.message,
          },
        });
      }
    } else if (source === 'ZIP') {
      log('📂 Extracting ZIP...');
      execSync(`unzip -q "${zipPath}" -d "${buildDir}" || true`);
      // Move nested dir up if needed
      const entries = await fs.readdir(buildDir);
      if (entries.length === 1) {
        const nested = path.join(buildDir, entries[0]);
        const stat = await fs.stat(nested);
        if (stat.isDirectory()) {
          const tmpDir = buildDir + '_tmp';
          await fs.move(nested, tmpDir);
          await fs.remove(buildDir);
          await fs.move(tmpDir, buildDir);
        }
      }
      await fs.remove(zipPath).catch(() => {});
    }

    log('✓ Source ready');

    // Step 2: Detect framework
    let detected = await detectFramework(buildDir);
    const framework = forcedFramework || detected.framework;
    const buildCommand = forcedBuild || detected.buildCommand;
    const outputDir = forcedOutputDir || detected.outputDir;

    log(`🔍 Framework detected: ${framework}`);
    log(`📋 Build command: ${buildCommand || 'none'}`);
    log(`📁 Output directory: ${outputDir}`);

    // Step 3: Generate Dockerfile if missing
    if (!detected.hasDockerfile) {
      const result = await generateDockerfile(buildDir, {
        framework,
        buildCommand,
        outputDir,
        nodeVersion: nodeVersion || '20',
      });
      if (result.generated) {
        log(`🐳 Generated Dockerfile for ${framework}`);
      }
    } else {
      log('🐳 Using existing Dockerfile');
    }

    // Step 4: Build Docker image
    const imageTag = `deployhub-build-${deploymentId}`.toLowerCase();
    log(`🔨 Building Docker image (tag: ${imageTag})...`);

    await buildDockerImage(buildDir, imageTag, log);
    log('✓ Docker image built successfully');

    // Step 5: Run container and extract output
    const outputPath = path.join(WORK_DIR, `${deploymentId}-output`);
    await fs.ensureDir(outputPath);

    log(`📤 Extracting build output from container (dir: ${outputDir})...`);

    const envArray = Object.entries(envVars || {}).map(([k, v]) => `${k}=${v}`);

    const container = await docker.createContainer({
      Image: imageTag,
      Cmd: ['sh', '-c', 'echo done'],
      Env: envArray,
    });
    await container.start();

    // Copy output dir from container
    const containerOutputDir = outputDir === '.' ? '/app' : `/app/${outputDir}`;
    try {
      const tarStream = await new Promise((resolve, reject) => {
        container.getArchive({ path: containerOutputDir }, (err, stream) => {
          if (err) reject(err);
          else resolve(stream);
        });
      });

      await new Promise((resolve, reject) => {
        const extract = tar.extract(outputPath);
        tarStream.pipe(extract);
        extract.on('finish', resolve);
        extract.on('error', reject);
      });
    } catch (e) {
      log(`⚠️  Could not extract ${containerOutputDir}, using build dir as output`);
      await fs.copy(buildDir, outputPath, { overwrite: true });
    }

    await container.wait().catch(() => {});
    await cleanup(container, imageTag);
    log('✓ Container cleaned up');

    // Step 6: Upload to S3
    log('☁️  Uploading to S3...');

    // Find the actual output files (sometimes tar extracts a nested folder)
    let uploadDir = outputPath;
    const outputEntries = await fs.readdir(outputPath);
    if (outputEntries.length === 1) {
      const possible = path.join(outputPath, outputEntries[0]);
      const stat = await fs.stat(possible);
      if (stat.isDirectory()) uploadDir = possible;
    }

    const { prefix } = await uploadDirectoryToS3(uploadDir, deploymentId, log);
    const previewUrl = getDeploymentUrl(deploymentId);

    log(`✓ Deployed! Preview URL: ${previewUrl}`);

    // Step 7: Mark SUCCESS
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'SUCCESS',
        previewUrl,
        s3Key: prefix,
        buildLog,
        finishedAt: new Date(),
        framework,
      },
    });

    // Cleanup local build files
    await fs.remove(buildDir).catch(() => {});
    await fs.remove(outputPath).catch(() => {});

    return { success: true, previewUrl };

  } catch (err) {
    log(`❌ Build failed: ${err.message}`);
    logger.error(`Deployment ${deploymentId} failed:`, err);

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'FAILED',
        errorMsg: err.message,
        buildLog,
        finishedAt: new Date(),
      },
    }).catch(() => {});

    // Cleanup
    await fs.remove(buildDir).catch(() => {});

    throw err;
  }
});

logger.info('🚀 Deployment worker started (FIFO, concurrency: 1)');
