'use strict';

// ── 1. Load .env file FIRST (before anything else reads process.env) ─────────
require('dotenv').config();

// ── 2. Validate all environment variables — exits with clear error if missing ─
const env = require('./utils/env');

// ── 3. Now safe to load app modules ──────────────────────────────────────────
require('express-async-errors');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const { logger }       = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { requireAuth }  = require('./middleware/auth');
const projectRoutes    = require('./controllers/projectController');
const deploymentRoutes = require('./controllers/deploymentController');
const nginxRoutes      = require('./controllers/nginxController');
require('./workers/deploymentWorker');

const app = express();

app.set('trust proxy', true);

// ── CORS — allow only the configured frontend origin ─────────────────────────
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(morgan(env.IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

// ── Health check — public, no auth ───────────────────────────────────────────
// Used by: frontend startup check, Docker health checks, load balancers, CI
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    env: env.NODE_ENV,
  });
});

// ── Connection status — public, exposes feature flags to the frontend ─────────
// Frontend pings this on load to know what features are available.
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    features: {
      aiDetection:  !!env.OPENROUTER_API_KEY,
      ec2Deploys:   !!(env.EC2_INSTANCE_ID && env.EC2_PUBLIC_DNS),
      s3Deploys:    !!env.S3_BUCKET_NAME,
      customDomain: !!env.DEPLOYMENT_BASE_URL,
    },
    region: env.AWS_REGION,
  });
});

// ── API routes — protected by Clerk auth ─────────────────────────────────────
app.use('/api/projects',    requireAuth, projectRoutes);
app.use('/api/deployments', requireAuth, deploymentRoutes);
app.use('/api/nginx',       requireAuth, nginxRoutes);

// ── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Startup: recover or fail orphaned in-progress deployments ────────────────
// Two scenarios on server restart:
//
// A) Deployment was BUILDING when server died, but the EC2 container is
//    actually running fine (the build + deploy finished, only the final
//    prisma.update never ran). In this case we can RECOVER the deployment
//    by reading the previewUrl from the PortAllocation record.
//
// B) Deployment was truly mid-flight (e.g. Docker build was running) and
//    nothing made it to EC2. In this case we mark it FAILED.
//
// We distinguish by checking whether a PortAllocation exists for that
// deployment — if it does, EC2 was reached and we recover; if not, we fail.

const { prisma } = require('./utils/prisma');
async function reconcileStuckDeployments() {
  try {
    const stuck = await prisma.deployment.findMany({
      where: { status: { in: ['QUEUED', 'BUILDING'] } },
    });
 
    if (stuck.length === 0) return;
    logger.warn(`[startup] Found ${stuck.length} stuck deployment(s) — reconciling...`);
 
    for (const dep of stuck) {
      // Check if EC2 port was allocated → means deploy reached EC2 successfully
      const alloc = await prisma.portAllocation.findFirst({
        where: { deploymentId: dep.id, active: true },
      });
 
      if (alloc && process.env.EC2_PUBLIC_DNS) {
        // EC2 container is live — recover the deployment as SUCCESS
        const recoveredUrl = dep.previewUrl || `http://${process.env.EC2_PUBLIC_DNS}:${alloc.hostPort}`;
        await prisma.deployment.update({
          where: { id: dep.id },
          data: {
            status:     'SUCCESS',
            previewUrl: recoveredUrl,
            hostPort:   alloc.hostPort,
            finishedAt: new Date(),
            buildLog:   (dep.buildLog || '') + '\n[Recovered after server restart — container is live]',
          },
        });
        logger.info(`[startup] Recovered deployment ${dep.id} → ${recoveredUrl} (port ${alloc.hostPort})`);
      } else {
        // No EC2 allocation — deploy never finished, mark as FAILED
        await prisma.deployment.update({
          where: { id: dep.id },
          data: {
            status:     'FAILED',
            finishedAt: new Date(),
            buildLog:   (dep.buildLog || '') + '\n[Server restarted while deployment was in progress. Please redeploy.]',
          },
        });
        logger.warn(`[startup] Marked deployment ${dep.id} as FAILED (no EC2 allocation found)`);
      }
    }
  } catch (err) {
    logger.error('[startup] Failed to reconcile stuck deployments:', err.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  logger.info(`DeployHub backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`CORS origin: ${env.FRONTEND_URL}`);
  logger.info(`AI detection: ${env.OPENROUTER_API_KEY ? 'enabled' : 'disabled (no OPENROUTER_API_KEY)'}`);
  logger.info(`EC2 target:   ${env.EC2_INSTANCE_ID || 'not configured'}`);
  logger.info(`S3 bucket:    ${env.S3_BUCKET_NAME  || 'not configured'}`);
});

module.exports = app;
