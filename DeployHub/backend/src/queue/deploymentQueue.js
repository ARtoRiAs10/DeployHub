'use strict';
const Bull    = require('bull');
const IORedis = require('ioredis');

// ── Upstash (and any rediss:// TLS endpoint) needs two specific ioredis flags:
//   • maxRetriesPerRequest: null  — lets Bull's internal blocking commands work
//   • enableReadyCheck: false     — Upstash doesn't support the Redis WAIT command
//
// Bull's built-in URL parser doesn't set these, so we hand Bull a createClient
// factory instead of a raw URL. This works for both plain redis:// (local dev)
// and rediss:// (Upstash / any TLS Redis).

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_TLS   = REDIS_URL.startsWith('rediss://');

function makeRedisClient() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,   // required by Bull's blocking pop commands
    enableReadyCheck:     false,  // required by Upstash (no WAIT support)
    tls: USE_TLS ? { rejectUnauthorized: false } : undefined,
  });
}

const LOCK_DURATION    = 30 * 60 * 1000;
const LOCK_RENEW_TIME  = 15 * 60 * 1000;
const STALLED_INTERVAL =  5 * 60 * 1000;

const deploymentQueue = new Bull('deployments', {
  // createClient is called by Bull for 3 connection roles:
  //   'client'     — normal commands (add, update, etc.)
  //   'subscriber' — pub/sub for job events
  //   'bclient'    — blocking pop (used by the worker)
  // Each must be its own IORedis instance — they cannot be shared.
  createClient(type) {
    return makeRedisClient();
  },

  settings: {
    lockDuration:    LOCK_DURATION,
    lockRenewTime:   LOCK_RENEW_TIME,
    stalledInterval: STALLED_INTERVAL,
    maxStalledCount: 0,
  },

  defaultJobOptions: {
    attempts:         1,
    removeOnComplete: 50,
    removeOnFail:     100,
  },
});

deploymentQueue.on('error',   (err) => console.error('[queue] error:', err.message));
deploymentQueue.on('stalled', (job) => console.warn(`[queue] job ${job.id} (deployment ${job.data?.deploymentId}) stalled`));
deploymentQueue.on('failed',  (job, err) => console.error(`[queue] job ${job.id} failed:`, err.message));

module.exports = { deploymentQueue };