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
- Redis (local or cloud)
- PostgreSQL (local or cloud)
- AWS S3 bucket
- Clerk account

## Quick Start

### 1. Clone & Install

```bash
# Install frontend
cd frontend && npm install

# Install backend
cd ../backend && npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in values.

### 3. Database Setup

```bash
cd backend
npx prisma migrate dev --name init
```

### 4. Start Services

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Backend
cd backend && npm run dev

# Terminal 3: Start Frontend
cd frontend && npm run dev
```

### 5. Open App

Visit [http://localhost:3000](http://localhost:3000)

## Directory Structure

```
vercel-clone/
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/                 # App router pages
│   │   ├── components/          # React components
│   │   └── lib/                 # Utilities
│   └── package.json
├── backend/                     # Express API
│   ├── src/
│   │   ├── controllers/         # Route handlers
│   │   ├── services/            # Business logic
│   │   ├── workers/             # Deployment worker
│   │   ├── queue/               # Bull queue setup
│   │   ├── middleware/          # Auth middleware
│   │   └── utils/              # Helpers
│   ├── templates/               # Dockerfile templates
│   └── package.json
└── docker-compose.yml           # Local dev services
```
