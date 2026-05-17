'use strict';
const express  = require('express');
const router   = express.Router();
const { prisma } = require('../utils/prisma');
const { deregisterBackendFromNginx } = require('../services/nginxConfigService');
const { logger } = require('../utils/logger');

// ── List all projects for the current user ────────────────────────────────────
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

// ── Get single project ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// ── Create project ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const userId = req.auth.userId;
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
      isBackend:     isBackend != null ? Boolean(isBackend) : null,
      envVars:       {},
    },
  });
  res.status(201).json(project);
});

// ── Update project settings ───────────────────────────────────────────────────
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
      isBackend:     isBackend != null ? Boolean(isBackend) : existing.isBackend,
    },
  });
  res.json(project);
});

// ── GET env vars for a project ────────────────────────────────────────────────
// Returns env vars as { KEY: "VALUE", ... }
// Values are redacted (shown as "***") unless the caller passes ?reveal=1
router.get('/:id/env', async (req, res) => {
  const userId  = req.auth.userId;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const raw  = (project.envVars && typeof project.envVars === 'object') ? project.envVars : {};
  const reveal = req.query.reveal === '1';
  const result = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, reveal ? v : '***'])
  );
  res.json({ envVars: result, count: Object.keys(raw).length });
});

// ── PUT env vars — replaces the entire env vars map ──────────────────────────
// Body: { envVars: { KEY: "VALUE", ... } }
// Passing an empty object clears all env vars.
router.put('/:id/env', async (req, res) => {
  const userId  = req.auth.userId;
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const { envVars } = req.body;
  if (typeof envVars !== 'object' || Array.isArray(envVars) || envVars === null)
    return res.status(400).json({ error: 'envVars must be a key-value object' });

  // Validate keys: must be valid env var names (POSIX)
  const invalidKeys = Object.keys(envVars).filter(k => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
  if (invalidKeys.length > 0)
    return res.status(400).json({ error: `Invalid env var names: ${invalidKeys.join(', ')}` });

  // Stringify all values
  const sanitized = Object.fromEntries(
    Object.entries(envVars).map(([k, v]) => [k, String(v)])
  );

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data:  { envVars: sanitized },
  });

  res.json({ envVars: sanitized, count: Object.keys(sanitized).length });
});

// ── PATCH env vars — merge / add / delete individual keys ────────────────────
// Body: { set: { KEY: "VALUE" }, delete: ["OLD_KEY"] }
router.patch('/:id/env', async (req, res) => {
  const userId  = req.auth.userId;
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const current = (existing.envVars && typeof existing.envVars === 'object') ? { ...existing.envVars } : {};
  const toSet   = req.body.set    || {};
  const toDel   = req.body.delete || [];

  const invalidKeys = Object.keys(toSet).filter(k => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
  if (invalidKeys.length > 0)
    return res.status(400).json({ error: `Invalid env var names: ${invalidKeys.join(', ')}` });

  for (const [k, v] of Object.entries(toSet)) current[k] = String(v);
  for (const k of toDel) delete current[k];

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data:  { envVars: current },
  });

  res.json({ envVars: current, count: Object.keys(current).length });
});

// ── Delete project ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId  = req.auth.userId;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Deactivate port allocations so the port is returned to the free pool
  await prisma.portAllocation.updateMany({
    where: { projectId: req.params.id, active: true },
    data:  { active: false },
  });

  // Remove nginx conf for backend projects (fire-and-forget, non-fatal)
  if (project.isBackend && process.env.EC2_INSTANCE_ID) {
    deregisterBackendFromNginx({
      instanceId: process.env.EC2_INSTANCE_ID,
      projectId:  req.params.id,
      log: (msg) => logger.info(`[project/delete] ${msg}`),
    }).catch(err => logger.warn(`[project/delete] nginx deregister error: ${err.message}`));
  }

  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

module.exports = router;
