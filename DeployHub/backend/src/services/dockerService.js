'use strict';
const Docker = require('dockerode');
const tar    = require('tar-fs');
const { logger } = require('../utils/logger');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

async function buildDockerImage(repoDir, tag, logCallback) {
  return new Promise((resolve, reject) => {
    const pack = tar.pack(repoDir);
    docker.buildImage(pack, { t: tag, forcerm: true }, (err, stream) => {
      if (err) return reject(err);
      let imageId = null;
      const buildErrors = [];
      docker.modem.followProgress(stream,
        (buildErr, output) => {
          if (buildErr) return reject(buildErr);
          if (buildErrors.length > 0) return reject(new Error(buildErrors.join('\n')));
          resolve(imageId || tag);
        },
        (event) => {
          const msg = event.stream || event.status || '';
          if (msg.trim()) logCallback && logCallback(msg.trim());
          if (event.error) {
            const errMsg = event.error.trim();
            buildErrors.push(errMsg);
            logCallback && logCallback(`❌ Docker build error: ${errMsg}`);
            if (event.errorDetail?.message && event.errorDetail.message !== errMsg)
              logCallback && logCallback(`   Detail: ${event.errorDetail.message}`);
          }
          if (event.aux?.ID) imageId = event.aux.ID;
        }
      );
    });
  });
}

async function cleanup(container, imageTag) {
  if (container) {
    try { await container.remove({ force: true }); } catch (e) { logger.warn('Could not remove container:', e.message); }
  }
  if (imageTag) {
    try { await docker.getImage(imageTag).remove({ force: true }); } catch (e) { logger.warn('Could not remove image:', e.message); }
  }
}

module.exports = { buildDockerImage, cleanup, docker };
