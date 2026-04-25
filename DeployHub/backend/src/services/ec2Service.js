'use strict';
const { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand, GetAuthorizationTokenCommand } = require('@aws-sdk/client-ecr');
const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
const { execSync } = require('child_process');
const { logger }   = require('../utils/logger');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ecr    = new ECRClient({ region: REGION });
const ssm    = new SSMClient({ region: REGION });

async function ensureEcrRepository(repoName) {
  try {
    const res = await ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [repoName] }));
    return res.repositories[0].repositoryUri;
  } catch (err) {
    if (err.name === 'RepositoryNotFoundException') {
      const res = await ecr.send(new CreateRepositoryCommand({ repositoryName: repoName, imageScanningConfiguration: { scanOnPush: false } }));
      return res.repository.repositoryUri;
    }
    throw err;
  }
}

async function getEcrAuth() {
  const res   = await ecr.send(new GetAuthorizationTokenCommand({}));
  const token = Buffer.from(res.authorizationData[0].authorizationToken,'base64').toString('utf8');
  const [username, password] = token.split(':');
  return { username, password, endpoint: res.authorizationData[0].proxyEndpoint };
}

async function pushImageToEcr(localTag, repositoryUri, imageTag, log) {
  const fullTag = `${repositoryUri}:${imageTag}`;
  const { username, password, endpoint } = await getEcrAuth();
  log('🔐 Authenticating with ECR...');
  execSync(`echo "${password}" | docker login --username ${username} --password-stdin ${endpoint}`, { stdio: 'pipe' });
  log(`🏷️  Tagging image as ${fullTag}`);
  execSync(`docker tag ${localTag} ${fullTag}`, { stdio: 'pipe' });
  log('📤 Pushing image to ECR...');
  execSync(`docker push ${fullTag}`, { stdio: 'inherit' });
  log(`✓ Image pushed: ${fullTag}`);
  return fullTag;
}

async function deployToEc2({ instanceId, ecrImageUri, containerName, port=3000, envVars={}, log }) {
  const envFlags   = Object.entries(envVars).map(([k,v]) => `-e ${k}="${v.replace(/"/g,'\\"')}"`).join(' ');
  const ecrEndpoint = ecrImageUri.split('/')[0];
  const script = `set -e
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ecrEndpoint}
docker pull ${ecrImageUri}
docker ps -q --filter "name=${containerName}" | xargs -r docker stop || true
docker ps -aq --filter "name=${containerName}" | xargs -r docker rm || true
docker run -d --name ${containerName} --restart unless-stopped -p ${port}:${port} ${envFlags} ${ecrImageUri}
echo "✓ Container ${containerName} running on port ${port}"`;

  log(`🖥️  Sending deploy command to EC2 ${instanceId}...`);
  const sendRes = await ssm.send(new SendCommandCommand({
    InstanceIds: [instanceId], DocumentName: 'AWS-RunShellScript',
    Parameters: { commands: [script] }, TimeoutSeconds: 300,
  }));
  const commandId = sendRes.Command.CommandId;
  log(`⏳ SSM command ${commandId} sent, waiting...`);

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const inv = await ssm.send(new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId })).catch(() => null);
    if (!inv) continue;
    if (inv.Status === 'Success') { log('✓ EC2 deployment succeeded'); if (inv.StandardOutputContent) log(inv.StandardOutputContent); return; }
    if (['Failed','Cancelled','TimedOut'].includes(inv.Status)) throw new Error(`EC2 deployment failed: ${inv.StandardErrorContent||inv.StatusDetails||inv.Status}`);
    log(`  Status: ${inv.Status}...`);
  }
  throw new Error('EC2 deployment timed out after 5 minutes');
}

async function deployBackend({ deploymentId, localImageTag, port=3000, envVars={}, log }) {
  const instanceId  = process.env.EC2_INSTANCE_ID;
  const publicDns   = process.env.EC2_PUBLIC_DNS;
  if (!instanceId) throw new Error('EC2_INSTANCE_ID env var is not set');
  if (!publicDns)  throw new Error('EC2_PUBLIC_DNS env var is not set');

  const repoName      = `deployhub/${deploymentId}`.toLowerCase();
  const containerName = `deployhub-${deploymentId}`.toLowerCase();

  log(`📦 Setting up ECR repository: ${repoName}`);
  const repositoryUri = await ensureEcrRepository(repoName);
  const ecrImageUri   = await pushImageToEcr(localImageTag, repositoryUri, 'latest', log);
  await deployToEc2({ instanceId, ecrImageUri, containerName, port, envVars, log });

  const backendUrl = `http://${publicDns}:${port}`;
  log(`🌐 Backend live at: ${backendUrl}`);
  return { backendUrl, ecrImageUri };
}

module.exports = { deployBackend, ensureEcrRepository, pushImageToEcr };
