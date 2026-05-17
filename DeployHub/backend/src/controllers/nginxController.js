'use strict';
/**
 * nginxController.js
 *
 * Admin API routes for nginx config management.
 *
 * Routes:
 *   POST /api/nginx/sync        — Re-write ALL active backend project confs and reload nginx
 *   GET  /api/nginx/status      — List all active port allocations with their URLs
 *   DELETE /api/nginx/:projectId — Remove a project's nginx conf and reload
 */

const express = require('express');
const router  = express.Router();
const { prisma } = require('../utils/prisma');
const { syncAllBackendsToNginx, deregisterBackendFromNginx } = require('../services/nginxConfigService');
const { logger } = require('../utils/logger');

const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID;
const EC2_PUBLIC_DNS  = process.env.EC2_PUBLIC_DNS;

// ── POST /api/nginx/sync ──────────────────────────────────────────────────────
// Re-generates ALL active backend project nginx confs on the EC2 instance.
// Use this after EC2 restarts or nginx package updates wipe conf.d/.
router.post('/sync', async (req, res) => {
  if (!EC2_INSTANCE_ID || !EC2_PUBLIC_DNS) {
    return res.status(503).json({ error: 'EC2 not configured — EC2_INSTANCE_ID or EC2_PUBLIC_DNS missing' });
  }

  // Fetch all active port allocations with their linked deployment info
  const allocations = await prisma.portAllocation.findMany({
    where: { active: true },
    include: {
      deployment: { select: { id: true, framework: true } },
      project:    { select: { id: true, name: true } },
    },
    orderBy: { hostPort: 'asc' },
  });

  const projects = allocations.map(a => ({
    projectId:     a.projectId,
    deploymentId:  a.deploymentId,
    hostPort:      a.hostPort,
    containerPort: inferContainerPort(a.deployment?.framework),
  }));

  const syncLog = [];
  const log = (msg) => {
    syncLog.push(msg);
    logger.info(`[nginx/sync] ${msg}`);
  };

  await syncAllBackendsToNginx({
    instanceId: EC2_INSTANCE_ID,
    projects,
    publicDns:  EC2_PUBLIC_DNS,
    log,
  });

  res.json({
    synced:   projects.length,
    projects: projects.map(p => ({
      projectId:    p.projectId,
      deploymentId: p.deploymentId,
      hostPort:     p.hostPort,
      url:          `http://${EC2_PUBLIC_DNS}:${p.hostPort}`,
    })),
    log: syncLog,
  });
});

// ── GET /api/nginx/status ─────────────────────────────────────────────────────
// Returns all active port allocations with their public URLs.
router.get('/status', async (req, res) => {
  if (!EC2_PUBLIC_DNS) {
    return res.status(503).json({ error: 'EC2_PUBLIC_DNS not configured' });
  }

  const allocations = await prisma.portAllocation.findMany({
    where:   { active: true },
    include: {
      project:    { select: { id: true, name: true } },
      deployment: { select: { id: true, status: true, previewUrl: true, framework: true, createdAt: true } },
    },
    orderBy: { hostPort: 'asc' },
  });

  const portRangeStart = parseInt(process.env.EC2_PORT_RANGE_START || '3100', 10);
  const portRangeEnd   = parseInt(process.env.EC2_PORT_RANGE_END   || '3999', 10);
  const totalSlots     = portRangeEnd - portRangeStart + 1;

  res.json({
    ec2PublicDns:    EC2_PUBLIC_DNS,
    portRange:       { start: portRangeStart, end: portRangeEnd, total: totalSlots },
    occupiedCount:   allocations.length,
    availableCount:  totalSlots - allocations.length,
    allocations: allocations.map(a => ({
      projectId:    a.projectId,
      projectName:  a.project?.name,
      deploymentId: a.deploymentId,
      hostPort:     a.hostPort,
      url:          `http://${EC2_PUBLIC_DNS}:${a.hostPort}`,
      previewUrl:   a.deployment?.previewUrl,
      framework:    a.deployment?.framework,
      deployedAt:   a.deployment?.createdAt,
    })),
  });
});

// ── DELETE /api/nginx/:projectId ──────────────────────────────────────────────
// Removes the nginx conf for a project and reloads nginx.
// Also deactivates the port allocation in DB.
router.delete('/:projectId', async (req, res) => {
  if (!EC2_INSTANCE_ID) {
    return res.status(503).json({ error: 'EC2_INSTANCE_ID not configured' });
  }

  const { projectId } = req.params;

  // Verify the project belongs to this user
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: req.auth.userId },
  });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Deactivate port allocation
  await prisma.portAllocation.updateMany({
    where: { projectId, active: true },
    data:  { active: false },
  });

  const removeLog = [];
  await deregisterBackendFromNginx({
    instanceId: EC2_INSTANCE_ID,
    projectId,
    log: (msg) => { removeLog.push(msg); logger.info(`[nginx/deregister] ${msg}`); },
  });

  res.json({ removed: true, projectId, log: removeLog });
});

// ── Helper ────────────────────────────────────────────────────────────────────
function inferContainerPort(framework) {
  const ports = {
    'node-backend': 3000, node: 3000, nextjs: 3000, nuxt: 3000, sveltekit: 3000,
    fastapi: 8000, flask: 8000, django: 8000, python: 8000,
    go: 8080, rust: 8080, php: 80, docker: 3000,
  };
  return (framework && ports[framework]) || 3000;
}

module.exports = router;
