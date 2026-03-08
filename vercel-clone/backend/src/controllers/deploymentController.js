const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { deploymentQueue } = require('../queue/deploymentQueue');

const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// GET /api/deployments - list deployments for user (or filter by project)
router.get('/', async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, limit = 20 } = req.query;

  const where = { userId };
  if (projectId) where.projectId = projectId;

  const deployments = await prisma.deployment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    include: { project: true },
  });

  res.json(deployments);
});

// GET /api/deployments/:id
router.get('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const deployment = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId },
    include: { project: true },
  });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  res.json(deployment);
});

// POST /api/deployments/github - deploy from GitHub URL
router.post('/github', async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, repoUrl, branch = 'main', buildCommand, outputDir, framework, nodeVersion } = req.body;

  if (!projectId || !repoUrl) {
    return res.status(400).json({ error: 'projectId and repoUrl are required' });
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      userId,
      status: 'QUEUED',
      source: 'GITHUB',
      branch,
      framework: framework || project.framework,
      buildCommand: buildCommand || project.buildCommand,
      outputDir: outputDir || project.outputDir,
    },
  });

  // Add to queue
  await deploymentQueue.add('deploy', {
    deploymentId: deployment.id,
    userId,
    source: 'GITHUB',
    repoUrl: repoUrl || project.repoUrl,
    branch,
    framework: deployment.framework,
    buildCommand: deployment.buildCommand,
    outputDir: deployment.outputDir,
    nodeVersion: nodeVersion || project.nodeVersion || '20',
    envVars: project.envVars || {},
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  res.status(201).json(deployment);
});

// POST /api/deployments/zip - deploy from ZIP upload
router.post('/zip', upload.single('file'), async (req, res) => {
  const userId = req.auth.userId;
  const { projectId, buildCommand, outputDir, framework, nodeVersion } = req.body;

  if (!projectId || !req.file) {
    return res.status(400).json({ error: 'projectId and zip file are required' });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      userId,
      status: 'QUEUED',
      source: 'ZIP',
      framework: framework || project.framework,
      buildCommand: buildCommand || project.buildCommand,
      outputDir: outputDir || project.outputDir,
    },
  });

  await deploymentQueue.add('deploy', {
    deploymentId: deployment.id,
    userId,
    source: 'ZIP',
    zipPath: req.file.path,
    framework: deployment.framework,
    buildCommand: deployment.buildCommand,
    outputDir: deployment.outputDir,
    nodeVersion: nodeVersion || project.nodeVersion || '20',
    envVars: project.envVars || {},
  }, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 3000 },
  });

  res.status(201).json(deployment);
});

// DELETE /api/deployments/:id - cancel queued deployment
router.delete('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const deployment = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (!['QUEUED'].includes(deployment.status)) {
    return res.status(400).json({ error: 'Can only cancel QUEUED deployments' });
  }

  await prisma.deployment.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  });

  res.json({ success: true });
});

module.exports = router;
