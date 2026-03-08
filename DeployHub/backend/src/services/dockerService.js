const Docker = require('dockerode');
const path = require('path');
const tar = require('tar-fs');
const { logger } = require('../utils/logger');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

/**
 * Build a Docker image from a directory and return the image ID.
 */
async function buildDockerImage(repoDir, tag, logCallback) {
  return new Promise((resolve, reject) => {
    const pack = tar.pack(repoDir);

    docker.buildImage(pack, { t: tag, forcerm: true }, (err, stream) => {
      if (err) return reject(err);

      let imageId = null;

      docker.modem.followProgress(
        stream,
        (buildErr, output) => {
          if (buildErr) return reject(buildErr);
          // Try to extract imageId from last output
          const idLine = output?.find(o => o.aux?.ID);
          if (idLine) imageId = idLine.aux.ID;
          resolve(imageId || tag);
        },
        (event) => {
          const msg = event.stream || event.status || '';
          if (msg.trim()) {
            logCallback && logCallback(msg);
          }
        }
      );
    });
  });
}

/**
 * Copy a directory out of a running container.
 * Returns a stream of the tar archive.
 */
async function copyFromContainer(container, srcPath) {
  return new Promise((resolve, reject) => {
    container.getArchive({ path: srcPath }, (err, stream) => {
      if (err) return reject(err);
      resolve(stream);
    });
  });
}

/**
 * Run the build inside a container and extract the output directory.
 * For static site generators (non-server), we just need the build output.
 */
async function runBuildContainer(imageTag, outputDir, envVars = {}) {
  const envArray = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

  const container = await docker.createContainer({
    Image: imageTag,
    Cmd: ['sh', '-c', 'echo "build complete"'],
    Env: envArray,
    AttachStdout: true,
    AttachStderr: true,
  });

  await container.start();
  await container.wait();

  return container;
}

/**
 * Remove a container and optionally its image.
 */
async function cleanup(container, imageTag) {
  try {
    await container.remove({ force: true });
  } catch (e) {
    logger.warn('Could not remove container:', e.message);
  }

  try {
    const image = docker.getImage(imageTag);
    await image.remove({ force: true });
  } catch (e) {
    logger.warn('Could not remove image:', e.message);
  }
}

module.exports = { buildDockerImage, runBuildContainer, copyFromContainer, cleanup, docker };
