'use strict';
const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { prisma }          = require('../utils/prisma');
const { deploymentQueue } = require('../queue/deploymentQueue');

const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 100 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, limit = 20 } = req.query;
  const where = { userId };
  if (projectId) where.projectId = projectId;
  const deployments = await prisma.deployment.findMany({
    where, orderBy: { createdAt: 'desc' }, take: Number(limit), include: { project: true },
  });
  res.json(deployments);
});

router.get('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const deployment = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId }, include: { project: true },
  });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  res.json(deployment);
});

router.post('/github', async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, repoUrl, branch = 'main', buildCommand, outputDir,
          framework, nodeVersion, isBackend, projectSubDir } = req.body;
  if (!projectId || !repoUrl) return res.status(400).json({ error: 'projectId and repoUrl are required' });

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const resolvedFramework    = (framework    && framework    !== '') ? framework    : (project.framework    || null);
  const resolvedBuildCommand = (buildCommand && buildCommand !== '') ? buildCommand : (project.buildCommand || null);
  const resolvedOutputDir    = (outputDir    && outputDir    !== '') ? outputDir    : (project.outputDir    || null);
  const resolvedIsBackend    = Boolean(isBackend ?? project.isBackend ?? false);
  const resolvedSubDir       = (projectSubDir && projectSubDir !== '') ? projectSubDir : (project.projectSubDir || null);

  const deployment = await prisma.deployment.create({
    data: {
      projectId, userId, status: 'QUEUED', source: 'GITHUB', branch,
      framework: resolvedFramework, buildCommand: resolvedBuildCommand,
      outputDir: resolvedOutputDir, isBackend: resolvedIsBackend,
      projectSubDir: resolvedSubDir,
    },
  });

  await deploymentQueue.add('deploy', {
    deploymentId: deployment.id, source: 'GITHUB',
    repoUrl: project.repoUrl || repoUrl, branch,
    framework: resolvedFramework, buildCommand: resolvedBuildCommand,
    outputDir: resolvedOutputDir, nodeVersion: nodeVersion || project.nodeVersion || '20',
    isBackend: resolvedIsBackend, projectSubDir: resolvedSubDir,
    envVars: project.envVars || {},
  });

  res.status(201).json(deployment);
});

router.post('/zip', upload.single('file'), async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, projectSubDir } = req.body;
  if (!projectId || !req.file) return res.status(400).json({ error: 'projectId and file are required' });

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const resolvedSubDir = (projectSubDir && projectSubDir !== '') ? projectSubDir : (project.projectSubDir || null);

  const deployment = await prisma.deployment.create({
    data: {
      projectId, userId, status: 'QUEUED', source: 'ZIP',
      isBackend: Boolean(project.isBackend ?? false), projectSubDir: resolvedSubDir,
    },
  });

  await deploymentQueue.add('deploy', {
    deploymentId: deployment.id, source: 'ZIP', zipPath: req.file.path,
    framework: project.framework || null, buildCommand: project.buildCommand || null,
    outputDir: project.outputDir || null, nodeVersion: project.nodeVersion || '20',
    isBackend: Boolean(project.isBackend ?? false), projectSubDir: resolvedSubDir,
    envVars: project.envVars || {},
  });

  res.status(201).json(deployment);
});

router.post('/:id/redeploy', async (req, res) => {
  const userId = req.auth.userId;
  const orig = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId }, include: { project: true },
  });
  if (!orig) return res.status(404).json({ error: 'Deployment not found' });

  const deployment = await prisma.deployment.create({
    data: {
      projectId: orig.projectId, userId, status: 'QUEUED', source: orig.source,
      branch: orig.branch, framework: orig.framework, buildCommand: orig.buildCommand,
      outputDir: orig.outputDir, isBackend: orig.isBackend, projectSubDir: orig.projectSubDir,
    },
  });

  await deploymentQueue.add('deploy', {
    deploymentId: deployment.id, source: orig.source,
    repoUrl: orig.project?.repoUrl, branch: orig.branch,
    framework: orig.framework, buildCommand: orig.buildCommand,
    outputDir: orig.outputDir, nodeVersion: orig.project?.nodeVersion || '20',
    isBackend: orig.isBackend, projectSubDir: orig.projectSubDir,
    envVars: orig.project?.envVars || {},
  });

  res.status(201).json(deployment);
});

router.delete('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const d = await prisma.deployment.findFirst({ where: { id: req.params.id, userId } });
  if (!d) return res.status(404).json({ error: 'Deployment not found' });
  if (!['QUEUED','BUILDING'].includes(d.status))
    return res.status(400).json({ error: 'Only queued/building deployments can be cancelled' });
  await prisma.deployment.update({
    where: { id: req.params.id }, data: { status: 'CANCELLED', finishedAt: new Date() },
  });
  res.json({ cancelled: true });
});

module.exports = router;
