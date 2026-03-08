const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');

// GET /api/projects - list all projects for user
router.get('/', async (req, res) => {
  const userId = req.auth.userId;
  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      deployments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(projects);
});

// POST /api/projects - create project
router.post('/', async (req, res) => {
  const userId = req.auth.userId;
  const { name, repoUrl, framework, buildCommand, outputDir, nodeVersion, envVars } = req.body;

  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const project = await prisma.project.create({
    data: {
      userId,
      name,
      repoUrl,
      framework,
      buildCommand,
      outputDir,
      nodeVersion: nodeVersion || '20',
      envVars: envVars || {},
    },
  });

  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId },
    include: {
      deployments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const { name, repoUrl, framework, buildCommand, outputDir, nodeVersion, envVars } = req.body;

  const project = await prisma.project.updateMany({
    where: { id: req.params.id, userId },
    data: { name, repoUrl, framework, buildCommand, outputDir, nodeVersion, envVars },
  });

  if (project.count === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const deleted = await prisma.project.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (deleted.count === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
});

module.exports = router;
