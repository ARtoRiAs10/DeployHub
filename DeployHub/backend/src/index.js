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

// ── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  logger.info(`DeployHub backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`CORS origin: ${env.FRONTEND_URL}`);
  logger.info(`AI detection: ${env.OPENROUTER_API_KEY ? 'enabled' : 'disabled (no OPENROUTER_API_KEY)'}`);
  logger.info(`EC2 target:   ${env.EC2_INSTANCE_ID || 'not configured'}`);
  logger.info(`S3 bucket:    ${env.S3_BUCKET_NAME  || 'not configured'}`);
});

module.exports = app;
