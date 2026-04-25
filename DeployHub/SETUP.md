# DeployHub — Setup Guide

## Environment Variables & Secrets

DeployHub uses two `.env` files — **never commit them to git**.

```
backend/.env          ← backend secrets (DB, Redis, AWS, Clerk)
frontend/.env.local   ← frontend secrets (Clerk publishable key, API URL)
```

The `.gitignore` at the project root blocks all `*.env` files from ever being committed.

---

## Quick Start (Local Development)

### 1. Copy env templates

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.local.example  frontend/.env.local
```

### 2. Fill in required values

Open `backend/.env` and set:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Auto-set if using Docker Compose below |
| `REDIS_URL` | Auto-set if using Docker Compose below |
| `CLERK_SECRET_KEY` | [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys |
| `AWS_REGION` | Your AWS region, e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | [IAM Console](https://console.aws.amazon.com/iam/) → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | Same as above |
| `S3_BUCKET_NAME` | Your S3 bucket with static website hosting enabled |
| `EC2_INSTANCE_ID` | Your EC2 instance ID, e.g. `i-0abc123` |
| `EC2_PUBLIC_DNS` | Your EC2 public DNS, e.g. `ec2-xx.compute-1.amazonaws.com` |

Open `frontend/.env.local` and set:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Same Clerk secret key as backend |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` for local dev |

### 3. Start infrastructure

```bash
# Start PostgreSQL and Redis (Docker required)
docker-compose up -d postgres redis

# Wait for them to be healthy
docker-compose ps
```

### 4. Run database migrations

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the backend

```bash
# Still in backend/
npm run dev
# → Server starts on http://localhost:4000
# → If any required .env var is missing, the server exits immediately
#   with a clear error message telling you exactly which variable to set.
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → App starts on http://localhost:3000
# → The sidebar will show a green "Backend connected" indicator
# → If the backend is unreachable, it shows a red banner with setup instructions
```

---

## Environment Variable Reference

### Backend (`backend/.env`)

#### Required — app will not start without these

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (used by Bull job queue) |
| `CLERK_SECRET_KEY` | Clerk secret key for JWT verification |
| `AWS_REGION` | AWS region for S3 + ECR + SSM |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `S3_BUCKET_NAME` | S3 bucket for static deployments |
| `EC2_INSTANCE_ID` | EC2 instance for backend deployments |
| `EC2_PUBLIC_DNS` | EC2 public DNS for backend URLs |

#### Optional — have sensible defaults

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Express server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `DEPLOYMENT_BASE_URL` | S3 website URL | Override with CloudFront/custom domain |
| `OPENROUTER_API_KEY` | *(none)* | Enable AI framework detection. [Get key](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.3-8b-instruct:free` | OpenRouter model |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `BUILD_TIMEOUT_MS` | `300000` | Max Docker build time (ms) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | Clerk publishable key (browser-safe) |
| `CLERK_SECRET_KEY` | ✓ | Clerk secret key (middleware only) |
| `NEXT_PUBLIC_API_URL` | ✓ | Backend URL. Local: `http://localhost:4000` |

---

## Frontend ↔ Backend Connection

The frontend connects to the backend via the `NEXT_PUBLIC_API_URL` env variable. On every page load the dashboard sidebar pings `/health` and `/api/status` to:

1. **Confirm the backend is reachable** — shows a green dot or a red error banner
2. **Show which features are configured** — flags missing AWS vars before a deploy fails

### Connection states shown in the UI

| State | What the user sees |
|---|---|
| Checking | Nothing (brief, < 5s) |
| Connected, all features | Green dot · AWS region · dismiss button |
| Connected, missing features | Green dot + yellow warning badge → click to see which vars to set |
| Disconnected | Red banner with the exact backend URL and `npm run dev` command |

---

## AWS IAM Permissions

The IAM user needs these policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": ["arn:aws:s3:::YOUR_BUCKET_NAME","arn:aws:s3:::YOUR_BUCKET_NAME/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["ecr:*"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:SendCommand","ssm:GetCommandInvocation"],
      "Resource": "*"
    }
  ]
}
```

---

## EC2 Setup Requirements

Your EC2 instance needs:
- **SSM Agent** installed and running (`sudo systemctl status amazon-ssm-agent`)
- **IAM role** with `AmazonEC2RoleforSSM` policy attached
- **Docker** installed (`docker --version`)
- **Inbound ports** open for your app ports (e.g. 8080, 3000)

---

## S3 Bucket Setup

1. Create a bucket in your chosen region
2. **Disable** "Block all public access"
3. Enable **Static website hosting** (Properties tab)
4. Add this **bucket policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
  }]
}
```

---

## Production Deployment

For production, use `docker-compose --profile full up`:

```bash
# Both .env files must be filled in
cp backend/.env.example backend/.env    && vim backend/.env
cp frontend/.env.local.example frontend/.env.local && vim frontend/.env.local

# Build and start everything
docker-compose --profile full up -d

# Check all services are healthy
docker-compose ps
```

Nginx proxies:
- `GET /api/*` → backend:4000
- Everything else → frontend:3000

---

## Secrets Security Checklist

- [ ] `backend/.env` is in `.gitignore` ✓ (already configured)
- [ ] `frontend/.env.local` is in `.gitignore` ✓ (already configured)  
- [ ] AWS IAM user has **minimum required permissions** (not AdministratorAccess)
- [ ] Clerk keys are **rotated** if ever accidentally exposed
- [ ] EC2 security group only allows inbound traffic on required ports
- [ ] S3 bucket policy only allows `GetObject` publicly (not `PutObject`)
- [ ] `docker-compose.yml` does **not** contain real credentials ✓ (uses env files)
- [ ] CI/CD secrets stored in **GitHub Actions Secrets**, not in workflow YAML
