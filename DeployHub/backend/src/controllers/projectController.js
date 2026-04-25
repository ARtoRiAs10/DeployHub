'use strict';
const express  = require('express');
const router   = express.Router();
const { prisma } = require('../utils/prisma');

router.get('/', async (req, res) => {
  const userId = req.auth.userId;
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      deployments: { take: 1, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true } },
    },
  });
  res.json(projects);
});

router.get('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.post('/', async (req, res) => {
  const userId = req.auth.userId;
  // FIX: accept isBackend from the request body so the UI can mark a project
  // as a backend target without relying solely on framework auto-detection.
  const { name, repoUrl, framework, buildCommand, outputDir, nodeVersion,
          projectSubDir, isBackend } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const project = await prisma.project.create({
    data: {
      userId, name,
      repoUrl:       repoUrl       || null,
      framework:     framework     || null,
      buildCommand:  buildCommand  || null,
      outputDir:     outputDir     || null,
      nodeVersion:   nodeVersion   || '20',
      projectSubDir: projectSubDir || null,
      // Persist the user's explicit isBackend choice; null = let auto-detection decide
      isBackend:     isBackend != null ? Boolean(isBackend) : null,
    },
  });
  res.status(201).json(project);
});

router.put('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const { name, repoUrl, framework, buildCommand, outputDir, nodeVersion,
          projectSubDir, isBackend } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      name:          name          ?? existing.name,
      repoUrl:       repoUrl       ?? existing.repoUrl,
      framework:     framework     || null,
      buildCommand:  buildCommand  || null,
      outputDir:     outputDir     || null,
      nodeVersion:   nodeVersion   || existing.nodeVersion,
      projectSubDir: projectSubDir || null,
      // Allow explicitly setting null to revert to auto-detection
      isBackend:     isBackend != null ? Boolean(isBackend) : existing.isBackend,
    },
  });
  res.json(project);
});

router.delete('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' })
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

module.exports = router;
