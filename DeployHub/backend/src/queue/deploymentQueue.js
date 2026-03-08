const Bull = require('bull');
const { logger } = require('../utils/logger');

// Parse Redis URL to support both redis:// (local) and rediss:// (TLS, Upstash/Redis Cloud)
function buildRedisConfig(redisUrl) {
  const url = redisUrl || 'redis://localhost:6379';

  // If it's a TLS URL (rediss://), Bull needs tls config
  if (url.startsWith('rediss://')) {
    return {
      redis: url,
      settings: {
        // Upstash and Redis Cloud require TLS
        enableTLSForSentinelMode: false,
      },
      // Pass tls option via redis connection string parsing
      // Bull accepts a full URL string and handles it correctly
    };
  }

  return { redis: url };
}

const queueConfig = buildRedisConfig(process.env.REDIS_URL);

const deploymentQueue = new Bull('deployment-queue', {
  ...queueConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

deploymentQueue.on('error', (err) => {
  logger.error('Queue error:', err.message);
});

deploymentQueue.on('waiting', (jobId) => {
  logger.info(`Job ${jobId} waiting`);
});

deploymentQueue.on('active', (job) => {
  logger.info(`Job ${job.id} started - Deployment: ${job.data.deploymentId}`);
});

deploymentQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed - Deployment: ${job.data.deploymentId}`);
});

deploymentQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed - Deployment: ${job.data.deploymentId} - ${err.message}`);
});

module.exports = { deploymentQueue };
