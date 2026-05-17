'use strict';
const { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand, GetAuthorizationTokenCommand } = require('@aws-sdk/client-ecr');
const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
const { execSync } = require('child_process');
const { logger }   = require('../utils/logger');
const { prisma }   = require('../utils/prisma');
const { registerBackendWithNginx } = require('./nginxConfigService');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ecr    = new ECRClient({ region: REGION });
const ssm    = new SSMClient({ region: REGION });

// ── Port allocation config ────────────────────────────────────────────────────
// All backend containers on the single EC2 instance are assigned a unique host
// port in this range. The container's internal port stays as the app configured.
const PORT_RANGE_START = parseInt(process.env.EC2_PORT_RANGE_START || '3100', 10);
const PORT_RANGE_END   = parseInt(process.env.EC2_PORT_RANGE_END   || '3999', 10);

// ── ECR helpers ───────────────────────────────────────────────────────────────

async function ensureEcrRepository(repoName) {
  try {
    const res = await ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [repoName] }));
    return res.repositories[0].repositoryUri;
  } catch (err) {
    if (err.name === 'RepositoryNotFoundException') {
      const res = await ecr.send(new CreateRepositoryCommand({
        repositoryName: repoName,
        imageScanningConfiguration: { scanOnPush: false },
      }));
      return res.repository.repositoryUri;
    }
    throw err;
  }
}

async function getEcrAuth() {
  const res   = await ecr.send(new GetAuthorizationTokenCommand({}));
  const token = Buffer.from(res.authorizationData[0].authorizationToken, 'base64').toString('utf8');
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

// ── Port allocation ───────────────────────────────────────────────────────────

/**
 * Query the EC2 instance for ports currently in LISTEN state.
 * Returns a Set<number> of occupied ports.
 */
async function queryUsedPortsOnEc2(instanceId) {
  try {
    const sendRes = await ssm.send(new SendCommandCommand({
      InstanceIds:  [instanceId],
      DocumentName: 'AWS-RunShellScript',
      Parameters:   { commands: [`ss -tlnp 2>/dev/null | awk 'NR>1 {print $4}' | awk -F: '{print $NF}' | grep -E '^[0-9]+$' | sort -un`] },
      TimeoutSeconds: 30,
    }));
    const commandId = sendRes.Command.CommandId;
    const deadline  = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const inv = await ssm.send(new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId })).catch(() => null);
      if (!inv) continue;
      if (inv.Status === 'Success') {
        const ports = new Set(
          (inv.StandardOutputContent || '').split('\n')
            .map(l => parseInt(l.trim(), 10))
            .filter(n => Number.isInteger(n) && n > 0)
        );
        logger.debug(`[portAlloc] EC2 used ports: ${[...ports].join(', ')}`);
        return ports;
      }
      if (['Failed', 'Cancelled', 'TimedOut'].includes(inv.Status)) {
        logger.warn(`[portAlloc] Could not query EC2 ports: ${inv.Status}`);
        return new Set();
      }
    }
  } catch (err) {
    logger.warn('[portAlloc] EC2 port query failed, using DB only:', err.message);
  }
  return new Set();
}

/**
 * Allocate a unique host port for a new backend deployment.
 *
 * Strategy (three layers):
 *  1. If the same project already has an active allocation, REUSE that port
 *     (re-deploying the same project keeps its URL stable).
 *  2. Scan the DB PortAllocation table for already-taken ports.
 *  3. Query the live EC2 instance for ports that are actually in use
 *     (catches ports used by non-DeployHub processes).
 *  4. Walk PORT_RANGE_START → PORT_RANGE_END, return the first free port.
 *
 * @param {string} projectId
 * @param {string} deploymentId  — the new deployment that will own this port
 * @param {string} instanceId
 * @returns {Promise<number>}
 */
async function allocateHostPort(projectId, deploymentId, instanceId) {
  // 1. Re-use existing project port so URL stays stable across re-deploys
  const existing = await prisma.portAllocation.findFirst({
    where: { projectId, active: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    logger.info(`[portAlloc] Reusing port ${existing.hostPort} for project ${projectId}`);
    // Deactivate old allocation record and create new one for this deployment
    await prisma.portAllocation.update({ where: { id: existing.id }, data: { active: false } });
    await prisma.portAllocation.create({
      data: { projectId, deploymentId, hostPort: existing.hostPort, active: true },
    });
    return existing.hostPort;
  }

  // 2. Ports taken by other projects in DB
  const dbAllocations = await prisma.portAllocation.findMany({ where: { active: true } });
  const dbPorts = new Set(dbAllocations.map(a => a.hostPort));

  // 3. Ports in use on EC2 right now
  const ec2Ports = await queryUsedPortsOnEc2(instanceId);

  const allUsed = new Set([...dbPorts, ...ec2Ports]);
  logger.info(`[portAlloc] Occupied ports (DB+EC2): ${[...allUsed].sort((a,b)=>a-b).join(', ') || 'none'}`);

  // 4. Pick first free port in range
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    if (!allUsed.has(p)) {
      await prisma.portAllocation.create({
        data: { projectId, deploymentId, hostPort: p, active: true },
      });
      logger.info(`[portAlloc] Allocated new port ${p} for project ${projectId}`);
      return p;
    }
  }

  throw new Error(
    `No available host port in range ${PORT_RANGE_START}–${PORT_RANGE_END}. ` +
    `All ${PORT_RANGE_END - PORT_RANGE_START + 1} ports are occupied.`
  );
}

// ── EC2 deployment ─────────────────────────────────────────────────────────────

async function deployToEc2({ instanceId, ecrImageUri, containerName, containerPort = 3000, hostPort, envVars = {}, log }) {
  // Build -e flags (values are shell-escaped)
  const envFlags = Object.entries(envVars)
    .map(([k, v]) => `-e ${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(' ');

  const ecrEndpoint = ecrImageUri.split('/')[0];

  // NOTE: We bind  hostPort (unique per project) → containerPort (what the app listens on).
  // This allows multiple projects to share the same EC2 instance without port collisions.
  const script = `set -e
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ecrEndpoint}
docker pull ${ecrImageUri}
docker ps -q --filter "name=${containerName}" | xargs -r docker stop || true
docker ps -aq --filter "name=${containerName}" | xargs -r docker rm || true
docker run -d \\
  --name ${containerName} \\
  --restart unless-stopped \\
  -p ${hostPort}:${containerPort} \\
  ${envFlags} \\
  ${ecrImageUri}
echo "✓ Container ${containerName} running — host port ${hostPort} → container port ${containerPort}"`;

  log(`🖥️  Sending deploy command to EC2 ${instanceId}...`);
  log(`🔌 Port mapping: EC2:${hostPort} → container:${containerPort}`);

  const sendRes = await ssm.send(new SendCommandCommand({
    InstanceIds:    [instanceId],
    DocumentName:   'AWS-RunShellScript',
    Parameters:     { commands: [script] },
    TimeoutSeconds: 300,
  }));
  const commandId = sendRes.Command.CommandId;
  log(`⏳ SSM command ${commandId} sent, waiting...`);

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const inv = await ssm.send(new GetCommandInvocationCommand({
      CommandId:  commandId,
      InstanceId: instanceId,
    })).catch(() => null);
    if (!inv) continue;
    if (inv.Status === 'Success') {
      log('✓ EC2 deployment succeeded');
      if (inv.StandardOutputContent) log(inv.StandardOutputContent);
      return;
    }
    if (['Failed', 'Cancelled', 'TimedOut'].includes(inv.Status)) {
      throw new Error(`EC2 deployment failed: ${inv.StandardErrorContent || inv.StatusDetails || inv.Status}`);
    }
    log(`  Status: ${inv.Status}...`);
  }
  throw new Error('EC2 deployment timed out after 5 minutes');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full backend deploy pipeline:
 *  1. Allocate a stable host port for this project (reuses same port on re-deploys)
 *  2. Push Docker image to ECR
 *  3. Run container on EC2 with correct port mapping
 *  4. Return the public URL using the allocated host port
 */
async function deployBackend({ deploymentId, projectId, localImageTag, port = 3000, envVars = {}, log }) {
  const instanceId = process.env.EC2_INSTANCE_ID;
  const publicDns  = process.env.EC2_PUBLIC_DNS;
  if (!instanceId) throw new Error('EC2_INSTANCE_ID env var is not set');
  if (!publicDns)  throw new Error('EC2_PUBLIC_DNS env var is not set');

  const repoName      = `deployhub/${deploymentId}`.toLowerCase();
  const containerName = `deployhub-${projectId}`.toLowerCase(); // stable name per project

  // Allocate a unique host port (or reuse existing one for this project)
  log(`🔌 Allocating host port for project ${projectId}...`);
  const hostPort = await allocateHostPort(projectId, deploymentId, instanceId);
  log(`✓ Host port: ${hostPort} (container listens on ${port})`);

  log(`📦 Setting up ECR repository: ${repoName}`);
  const repositoryUri = await ensureEcrRepository(repoName);
  const ecrImageUri   = await pushImageToEcr(localImageTag, repositoryUri, 'latest', log);

  await deployToEc2({ instanceId, ecrImageUri, containerName, containerPort: port, hostPort, envVars, log });

  // Register project with nginx on the EC2 instance and reload nginx.
  // This writes /etc/nginx/conf.d/projects/project-<projectId>.conf and
  // issues `nginx -s reload` so the URL is live immediately.
  const backendUrl = await registerBackendWithNginx({
    instanceId,
    projectId,
    deploymentId,
    hostPort,
    containerPort: port,
    publicDns,
    log,
  });

  log(`🌐 Backend live at: ${backendUrl}`);
  return { backendUrl, ecrImageUri, hostPort };
}

module.exports = { deployBackend, ensureEcrRepository, pushImageToEcr, allocateHostPort };
