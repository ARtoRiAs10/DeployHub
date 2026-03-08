const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { logger } = require('../utils/logger');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Upload an entire directory to S3 under a given prefix (deploymentId).
 * Returns the count of uploaded files.
 */
async function uploadDirectoryToS3(localDir, deploymentId, logCallback) {
  const files = await getAllFiles(localDir);
  let uploaded = 0;

  for (const filePath of files) {
    const relative = path.relative(localDir, filePath);
    const s3Key = `deployments/${deploymentId}/${relative}`.replace(/\\/g, '/');
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: stream,
      ContentType: contentType,
    }));

    uploaded++;
    if (uploaded % 10 === 0) {
      logCallback && logCallback(`Uploaded ${uploaded}/${files.length} files...`);
    }
  }

  logCallback && logCallback(`✓ Uploaded ${uploaded} files to S3`);
  return { uploaded, prefix: `deployments/${deploymentId}` };
}

async function getAllFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
    })
  );
  return files.flat();
}

function getDeploymentUrl(deploymentId) {
  const base = process.env.DEPLOYMENT_BASE_URL || `https://${BUCKET}.s3-website.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
  return `${base}/deployments/${deploymentId}/index.html`;
}

module.exports = { uploadDirectoryToS3, getDeploymentUrl };
