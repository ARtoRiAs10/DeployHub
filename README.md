# DeployHub — Vercel Clone

A full-stack deployment platform similar to Vercel. Deploy GitHub repos or ZIP files to S3 with auto-detected Dockerfiles.

## Architecture

```
Frontend (Next.js + shadcn/ui + Clerk)
       ↓
Backend API (Express + Node.js)
       ↓
Queue (Bull + Redis) → Worker → Docker Container
       ↓
S3 Bucket (static files)
       ↓
Nginx Proxy (serves deployments)
```

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **shadcn/ui** (UI components)
- **Clerk** (Authentication)
- **Tailwind CSS** (Styling)
- **React Query** (Data fetching)

### Backend
- **Node.js + Express** (API)
- **Bull + Redis** (Job queue)
- **Dockerode** (Docker management)
- **AWS SDK v3** (S3 uploads)
- **Prisma + PostgreSQL** (Database)

## Prerequisites

- Node.js 18+
- Docker Desktop
- Redis (local or cloud) 'sudo service redis-server start'
- PostgreSQL (local or cloud)
- AWS S3 bucket
- Clerk account
