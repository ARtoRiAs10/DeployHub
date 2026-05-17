'use strict';
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { logger } = require('../utils/logger');

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3     = new S3Client({ region: REGION });
const BUCKET = process.env.S3_BUCKET_NAME;

async function uploadDirectoryToS3(localDir, deploymentId, logCallback) {
  const files  = await getAllFiles(localDir);
  let uploaded = 0;
  for (const filePath of files) {
    const relative    = path.relative(localDir, filePath);
    const s3Key       = `deployments/${deploymentId}/${relative}`.replace(/\\/g, '/');
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: s3Key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    }));
    uploaded++;
    if (uploaded % 10 === 0) logCallback?.(`Uploaded ${uploaded}/${files.length} files...`);
  }
  logCallback?.(`✓ Uploaded ${uploaded} files to S3`);
  return { uploaded, prefix: `deployments/${deploymentId}` };
}

async function getAllFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files   = await Promise.all(entries.map(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? getAllFiles(full) : full;
  }));
  return files.flat();
}

/**
 * Returns the public URL for a static frontend deployment.
 *
 * S3 static-website hosting uses the s3-website endpoint:
 *   http://<bucket>.s3-website-<region>.amazonaws.com
 *   (note: some regions use s3-website.<region> without the dash)
 *
 * The S3 REST endpoint (s3.amazonaws.com) requires signed requests and does
 * NOT serve index.html automatically for directory paths — it returns XML
 * errors. Always use the website endpoint for public static hosting.
 *
 * Set DEPLOYMENT_BASE_URL in .env to override with a CloudFront or custom domain.
 */
function getDeploymentUrl(deploymentId) {
  if (process.env.DEPLOYMENT_BASE_URL) {
    return `${process.env.DEPLOYMENT_BASE_URL}/deployments/${deploymentId}/index.html`;
  }
  // S3 static website endpoint — serves index.html automatically for directory paths
  const websiteEndpoint = `http://${BUCKET}.s3.${REGION}.amazonaws.com`;
  return `${websiteEndpoint}/deployments/${deploymentId}/index.html`;
}

module.exports = { uploadDirectoryToS3, getDeploymentUrl };
