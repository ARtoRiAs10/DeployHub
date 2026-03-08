require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { logger } = require('./utils/logger');

// Route Imports
const projectRoutes = require('./controllers/projectController');
const deploymentRoutes = require('./controllers/deploymentController');

// Middleware Imports
const { errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');

// Start the queue worker (for processing deployments)
require('./workers/deploymentWorker');

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * 1. Trust Proxy
 * Essential for GitHub Codespaces to correctly handle 
 * header forwarding from the Codespace proxy.
 */
app.set('trust proxy', true);

/**
 * 2. Standard Middleware
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Log requests to the terminal
app.use(morgan('dev'));

// Parse incoming JSON payloads
app.use(express.json());

/**
 * 3. Health Check
 * Simple endpoint to verify the server is running.
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * 4. Protected Routes
 * requireAuth will now manually verify the Clerk JWT.
 */
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/deployments', requireAuth, deploymentRoutes);

/**
 * 5. Error Handling
 * Global error handler must be defined last.
 */
app.use(errorHandler);

/**
 * 6. Server Activation
 */
app.listen(PORT, () => {
  logger.info(`🚀 DeployHub backend running on port ${PORT}`);
  logger.info(`🔗 API Base: http://localhost:${PORT}/api`);
});