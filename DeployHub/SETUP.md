# DeployHub — Complete Setup Guide

## Prerequisites

Install these before starting:

1. **Node.js 18+** — https://nodejs.org
2. **Docker Desktop** — https://docker.com/products/docker-desktop (must be running)
3. **Redis** — Install via Docker or locally
4. **PostgreSQL** — Install via Docker or locally
5. **AWS Account** with S3 bucket
6. **Clerk account** — https://clerk.com (free)

---

## Step 1: Start Local Services (Database + Redis)

```bash
# From the project root
docker-compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

---

## Step 2: Setup Backend

### 2a. Install dependencies

```bash
cd backend
npm install
```

### 2b. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Clerk — get from https://dashboard.clerk.com → API Keys
CLERK_SECRET_KEY=sk_test_...

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=your-bucket-name

# URL prefix for served deployments
DEPLOYMENT_BASE_URL=https://your-bucket.s3-website.us-east-1.amazonaws.com
```

### 2c. Create S3 Bucket (AWS Console)

1. Go to AWS S3 → Create Bucket
2. Uncheck "Block all public access"
3. Enable static website hosting
4. Add bucket policy for public read:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
```

### 2d. Initialize database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 2e. Start backend

```bash
npm run dev
```

Backend runs at http://localhost:4000

---

## Step 3: Setup Frontend

### 3a. Install dependencies

```bash
cd frontend
npm install
```

### 3b. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Clerk — get from https://dashboard.clerk.com → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Points to your backend
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3c. Start frontend

```bash
npm run dev
```

Frontend runs at http://localhost:3000

---

## Step 4: Configure Clerk

1. Go to https://dashboard.clerk.com
2. Create a new application
3. Configure sign-in methods (Email, Google, GitHub — your choice)
4. Copy the API keys to both `.env` files
5. In Clerk Dashboard → Redirects, set:
   - Sign-in redirect: `/dashboard`
   - Sign-up redirect: `/dashboard`

---

## Step 5: Test a Deployment

1. Open http://localhost:3000
2. Sign up / Sign in
3. Create a new project:
   - Name: `my-test-app`
   - Repo URL: `https://github.com/facebook/create-react-app` (or any public repo)
4. Click **Deploy**
5. Watch the build log in real-time

---

## Architecture Overview

```
User Browser
    │
    ▼
Next.js Frontend (port 3000)
    │  Clerk JWT auth
    ▼
Express API (port 4000)
    │
    ├─ POST /api/deployments/github ──► Bull Queue (Redis)
    │                                        │
    │                                   Worker picks job
    │                                        │
    │                                   1. Clone repo (git)
    │                                   2. Detect framework
    │                                   3. Generate Dockerfile
    │                                   4. Docker build
    │                                   5. Extract output
    │                                   6. Upload to S3
    │                                        │
    ├─ GET /api/deployments/:id ◄────── Update DB (Prisma)
    │
PostgreSQL (port 5432)
    │
    └── Stores: Projects, Deployments, Logs
```

---

## Framework Auto-Detection Priority

When you deploy a repo **without** a Dockerfile, the worker:

1. Checks `Dockerfile` → use it directly
2. Checks `package.json` → reads dependencies:
   - `next` → Next.js template
   - `vite` → Vite template  
   - `react-scripts` → CRA template
   - `gatsby` → Gatsby template
   - `nuxt` → Nuxt template
   - `astro` → Astro template
   - `@sveltejs/kit` → SvelteKit template
3. Checks `requirements.txt` → Python template
4. Checks `go.mod` → Go template
5. Checks `Cargo.toml` → Rust template
6. Checks `composer.json` → PHP template
7. Checks `index.html` → Static HTML template
8. Falls back to generic static template

---

## Production Deployment

### Backend
- Deploy to Railway, Render, or EC2
- Set `NODE_ENV=production`
- Use managed Redis (Upstash, Redis Cloud)
- Use managed PostgreSQL (Supabase, Railway)

### Frontend
- Deploy to Vercel (ironic) or Netlify
- Set all `NEXT_PUBLIC_*` env vars

### Docker
- The backend needs access to Docker socket
- On cloud VMs, Docker must be installed and running
- On Railway/Render, Docker-in-Docker or Fargate is needed

---

## Troubleshooting

**"Cannot connect to Docker daemon"**
→ Make sure Docker Desktop is running

**"Redis connection failed"**  
→ Run `docker-compose up -d` or `redis-server`

**"Prisma migration failed"**
→ Make sure PostgreSQL is running: `docker-compose up -d`

**"Clerk auth failed"**
→ Check CLERK_SECRET_KEY is set correctly in backend `.env`

**"S3 upload failed"**
→ Check AWS credentials and bucket policy (public read required)
