const Bull = require('bull');
const deploymentQueue = new Bull('deployments', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: { attempts: 1, removeOnComplete: 50, removeOnFail: 100 },
});
deploymentQueue.on('error', (err) => console.error('[queue] error:', err.message));
module.exports = { deploymentQueue };
