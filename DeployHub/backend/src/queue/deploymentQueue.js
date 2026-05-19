'use strict';
const Bull = require('bull');

// EC2 deployments involve: clone → docker build → ECR push → SSM deploy.
// The whole flow can take 5–15 minutes for a cold image.
//
// Bull's default lockDuration is 30 seconds — meaning if the worker doesn't
// call job.progress() or heartbeat within 30s, Bull marks the job "stalled"
// and RE-QUEUES it. This causes the deployment to run again on server restart
// or even mid-flight, producing duplicate containers on EC2.
//
// Fix: set lockDuration to 30 minutes (well above any realistic deploy time)
// and lockRenewTime to half of that so the worker keeps renewing the lock.
// stalledInterval controls how often Bull checks for stalled jobs — set it
// high enough that a slow SSM command doesn't trigger a false stall.

const LOCK_DURATION    = 30 * 60 * 1000;  // 30 min — max time for one deployment
const LOCK_RENEW_TIME  = 15 * 60 * 1000;  // renew every 15 min
const STALLED_INTERVAL =  5 * 60 * 1000;  // check for stalled jobs every 5 min

const deploymentQueue = new Bull('deployments', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',

  settings: {
    lockDuration:    LOCK_DURATION,
    lockRenewTime:   LOCK_RENEW_TIME,
    stalledInterval: STALLED_INTERVAL,
    // How many times a stalled job can be restarted before being moved to failed.
    // Set to 0: never auto-restart stalled jobs — let the startup cleanup in
    // index.js mark them FAILED so the user can redeploy manually.
    maxStalledCount: 0,
  },

  defaultJobOptions: {
    attempts:         1,     // never auto-retry a failed deployment
    removeOnComplete: 50,    // keep last 50 completed jobs in Redis for history
    removeOnFail:     100,   // keep last 100 failed jobs for debugging
  },
});

deploymentQueue.on('error',   (err)  => console.error('[queue] error:', err.message));
deploymentQueue.on('stalled', (job)  => console.warn(`[queue] job ${job.id} (deployment ${job.data?.deploymentId}) stalled — will NOT be auto-requeued (maxStalledCount=0)`));
deploymentQueue.on('failed',  (job, err) => console.error(`[queue] job ${job.id} failed:`, err.message));

module.exports = { deploymentQueue };