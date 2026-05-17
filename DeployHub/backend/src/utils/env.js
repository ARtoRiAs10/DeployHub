'use strict';
/**
 * env.js — Validates and exports all environment variables.
 *
 * Called at the very top of src/index.js BEFORE any other require().
 * If a required variable is missing the process exits immediately with a
 * clear error message telling the developer exactly what to set.
 *
 * USAGE:
 *   const env = require('./utils/env');
 *   // env.DATABASE_URL, env.CLERK_SECRET_KEY, etc.
 */

const REQUIRED = [
  { key: 'DATABASE_URL',       hint: 'PostgreSQL connection string. Example: postgresql://user:pass@localhost:5432/deployhub' },
  { key: 'REDIS_URL',          hint: 'Redis connection string. Example: redis://localhost:6379' },
  { key: 'CLERK_SECRET_KEY',   hint: 'Get from https://dashboard.clerk.com → API Keys → Secret key (starts with sk_)' },
  { key: 'AWS_REGION',         hint: 'AWS region where your S3 bucket and EC2 live. Example: us-east-1' },
  { key: 'AWS_ACCESS_KEY_ID',  hint: 'IAM access key. Create at https://console.aws.amazon.com/iam/ with S3 + ECR + SSM permissions' },
  { key: 'AWS_SECRET_ACCESS_KEY', hint: 'IAM secret key paired with AWS_ACCESS_KEY_ID' },
  { key: 'S3_BUCKET_NAME',     hint: 'S3 bucket for static deployments. Must have static website hosting enabled.' },
  { key: 'EC2_INSTANCE_ID',    hint: 'EC2 instance ID for backend deployments. Example: i-0123456789abcdef0' },
  { key: 'EC2_PUBLIC_DNS',     hint: 'EC2 public DNS for backend URLs. Example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com' },
];

const OPTIONAL = [
  { key: 'PORT',               default: '4000',          hint: 'Port the Express server listens on' },
  { key: 'NODE_ENV',           default: 'development',   hint: 'development | production | test' },
  { key: 'FRONTEND_URL',       default: 'http://localhost:3000', hint: 'Allowed CORS origin (your frontend URL)' },
  { key: 'DEPLOYMENT_BASE_URL',default: null,            hint: 'Override S3 website URL (e.g. CloudFront domain)' },
  { key: 'OPENROUTER_API_KEY', default: null,            hint: 'OpenRouter API key for AI Dockerfile generation. Get from https://openrouter.ai/keys' },
  { key: 'OPENROUTER_MODEL',   default: 'meta-llama/llama-3.3-8b-instruct:free', hint: 'OpenRouter model to use for AI detection fallback' },
  { key: 'DOCKER_SOCKET',      default: '/var/run/docker.sock', hint: 'Docker socket path' },
  { key: 'LOG_LEVEL',          default: 'info',          hint: 'Winston log level: error | warn | info | debug' },
  { key: 'BUILD_TIMEOUT_MS',   default: '300000',        hint: 'Max Docker build time in ms (default 5 min)' },
  { key: 'EC2_PORT_RANGE_START', default: '3100',        hint: 'First host port DeployHub may assign to backend containers (default 3100)' },
  { key: 'EC2_PORT_RANGE_END',   default: '3999',  hint: 'Last host port DeployHub may assign to backend containers (default 3999)' },
  { key: 'NGINX_CONTAINER_NAME', default: null,    hint: 'nginx Docker container name on EC2 host. Unset = direct EC2:port access (current default).' },
  { key: 'NGINX_CONF_HOST_DIR',  default: null,    hint: 'Host path bind-mounted into nginx container at /etc/nginx/conf.d/projects. Only needed with NGINX_CONTAINER_NAME.' },
];

function validate() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const { key, hint } of REQUIRED) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push({ key, hint });
    }
  }

  // Apply defaults for optional variables and collect warnings for notable omissions
  for (const { key, default: def, hint } of OPTIONAL) {
    if (!process.env[key] || process.env[key].trim() === '') {
      if (def !== null) {
        process.env[key] = def;
      } else {
        // Optional with no default — note it
        warnings.push({ key, hint });
      }
    }
  }

  // Hard fail if any required vars are missing
  if (missing.length > 0) {
    const lines = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║          DeployHub — Missing Environment Variables           ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      '  The following required environment variables are not set.',
      '  Copy backend/.env.example → backend/.env and fill them in.',
      '',
    ];

    for (const { key, hint } of missing) {
      lines.push(`  ✗ ${key}`);
      lines.push(`    ${hint}`);
      lines.push('');
    }

    lines.push('  See: https://github.com/your-org/deployhub#environment-setup');
    lines.push('');
    console.error(lines.join('\n'));
    process.exit(1);
  }

  // Warn about missing optional-but-recommended vars
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n[env] Optional vars not set (some features will be disabled):');
    for (const { key, hint } of warnings) {
      console.warn(`  ○ ${key}: ${hint}`);
    }
    console.warn('');
  }

  // Warn about obviously placeholder values (still set, but unchanged from example)
  const PLACEHOLDER_PATTERNS = [
    /^your_/i, /^sk_test_your/i, /^pk_test_your/i,
    /^sk-or-your/i, /^i-0123456789/i, /^ec2-xx/i,
  ];
  const suspicious = REQUIRED.filter(({ key }) => {
    const val = process.env[key] || '';
    return PLACEHOLDER_PATTERNS.some(p => p.test(val));
  });

  if (suspicious.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('[env] WARNING: These vars look like unchanged placeholder values:');
    suspicious.forEach(({ key }) => console.warn(`  ! ${key}=${process.env[key]}`));
    console.warn('  Please replace with real credentials before deploying.\n');
  }

  return buildEnvObject();
}

function buildEnvObject() {
  return {
    // Server
    PORT:               parseInt(process.env.PORT || '4000', 10),
    NODE_ENV:           process.env.NODE_ENV || 'development',
    IS_PROD:            process.env.NODE_ENV === 'production',
    IS_TEST:            process.env.NODE_ENV === 'test',

    // Database / Cache
    DATABASE_URL:       process.env.DATABASE_URL,
    REDIS_URL:          process.env.REDIS_URL,

    // Auth (Clerk)
    CLERK_SECRET_KEY:   process.env.CLERK_SECRET_KEY,

    // AWS
    AWS_REGION:         process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID:  process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME:     process.env.S3_BUCKET_NAME,
    EC2_INSTANCE_ID:    process.env.EC2_INSTANCE_ID,
    EC2_PUBLIC_DNS:     process.env.EC2_PUBLIC_DNS,
    DEPLOYMENT_BASE_URL: process.env.DEPLOYMENT_BASE_URL || null,

    // AI / LLM
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || null,
    OPENROUTER_MODEL:   process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free',

    // App
    FRONTEND_URL:       process.env.FRONTEND_URL || 'http://localhost:3000',
    DOCKER_SOCKET:      process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    LOG_LEVEL:          process.env.LOG_LEVEL || 'info',
    BUILD_TIMEOUT_MS:   parseInt(process.env.BUILD_TIMEOUT_MS || '300000', 10),
    EC2_PORT_RANGE_START: parseInt(process.env.EC2_PORT_RANGE_START || '3100', 10),
    EC2_PORT_RANGE_END:   parseInt(process.env.EC2_PORT_RANGE_END   || '3999', 10),
    // Nginx container management (optional — unset = direct port access)
    NGINX_CONTAINER_NAME: process.env.NGINX_CONTAINER_NAME || null,
    NGINX_CONF_HOST_DIR:  process.env.NGINX_CONF_HOST_DIR  || null,
  };
}

// In test mode, skip validation (tests set their own env)
const env = process.env.NODE_ENV === 'test' ? buildEnvObject() : validate();

module.exports = env;