'use strict';
/**
 * Integration tests — REST API controllers (projectController + deploymentController)
 *
 * Strategy:
 *  - Build a minimal Express app from the controllers directly (no full server)
 *  - Mock Prisma client so no DB is needed
 *  - Mock deploymentQueue so no Redis is needed
 *  - Mock requireAuth so no Clerk is needed
 *  - Use supertest to make real HTTP requests through Express routing
 */
const express    = require('express');
const supertest  = require('supertest');
require('express-async-errors');

// ── Mock Prisma before requiring controllers ────────────────────────────────
const mockPrisma = {
  project: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
  },
  deployment: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
  },
};
jest.mock('../../src/utils/prisma', () => ({ prisma: mockPrisma }));

// ── Mock deployment queue ──────────────────────────────────────────────────
const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
jest.mock('../../src/queue/deploymentQueue', () => ({ deploymentQueue: mockQueue }));

// ── Mock worker (it auto-requires and connects to Redis on load) ───────────
jest.mock('../../src/workers/deploymentWorker', () => ({}));

// ── Mock auth middleware — injects userId directly ─────────────────────────
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.auth = { userId: 'test-user-123' }; next(); },
}));

// ── Mock logger to suppress output ────────────────────────────────────────
jest.mock('../../src/utils/logger', () => ({
  logger: { info:jest.fn(), warn:jest.fn(), error:jest.fn(), debug:jest.fn() },
}));

const projectRoutes    = require('../../src/controllers/projectController');
const deploymentRoutes = require('../../src/controllers/deploymentController');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { requireAuth }  = require('../../src/middleware/auth');

// Build test app
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects',    requireAuth, projectRoutes);
  app.use('/api/deployments', requireAuth, deploymentRoutes);
  app.use(errorHandler);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('ProjectController — REST API', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ── GET /api/projects ─────────────────────────────────────────────────────
  describe('GET /api/projects', () => {
    test('200 — returns list of projects for the authenticated user', async () => {
      const projects = [
        { id:'p1', name:'my-api', framework:'go', userId:'test-user-123', deployments:[] },
        { id:'p2', name:'my-web', framework:'vite', userId:'test-user-123', deployments:[] },
      ];
      mockPrisma.project.findMany.mockResolvedValue(projects);

      const res = await supertest(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('my-api');
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'test-user-123' } })
      );
    });

    test('200 — returns empty array when user has no projects', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      const res = await supertest(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── GET /api/projects/:id ────────────────────────────────────────────────
  describe('GET /api/projects/:id', () => {
    test('200 — returns project when found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id:'p1', name:'my-api', userId:'test-user-123' });
      const res = await supertest(app).get('/api/projects/p1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('p1');
    });

    test('404 — returns error when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);
      const res = await supertest(app).get('/api/projects/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  // ── POST /api/projects ───────────────────────────────────────────────────
  describe('POST /api/projects', () => {
    test('201 — creates project with valid data', async () => {
      const created = { id:'p3', name:'new-app', framework:'nextjs', isBackend:true, userId:'test-user-123' };
      mockPrisma.project.create.mockResolvedValue(created);

      const res = await supertest(app)
        .post('/api/projects')
        .send({ name:'new-app', framework:'nextjs', repoUrl:'https://github.com/user/repo', isBackend:true });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('new-app');
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name:'new-app', userId:'test-user-123' }),
        })
      );
    });

    test('400 — returns error when name is missing', async () => {
      const res = await supertest(app)
        .post('/api/projects')
        .send({ framework:'vite' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    });

    test('201 — persists isBackend field', async () => {
      mockPrisma.project.create.mockResolvedValue({ id:'p4', name:'my-go-api', isBackend:true });
      await supertest(app)
        .post('/api/projects')
        .send({ name:'my-go-api', isBackend:true });
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBackend:true }),
        })
      );
    });

    test('201 — isBackend=null when not provided (auto-detect)', async () => {
      mockPrisma.project.create.mockResolvedValue({ id:'p5', name:'unknown', isBackend:null });
      await supertest(app)
        .post('/api/projects')
        .send({ name:'unknown' });
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBackend:null }),
        })
      );
    });
  });

  // ── PUT /api/projects/:id ────────────────────────────────────────────────
  describe('PUT /api/projects/:id', () => {
    test('200 — updates project fields', async () => {
      const existing = { id:'p1', name:'old-name', framework:'vite', nodeVersion:'18', isBackend:false };
      mockPrisma.project.findFirst.mockResolvedValue(existing);
      mockPrisma.project.update.mockResolvedValue({ ...existing, name:'new-name' });

      const res = await supertest(app)
        .put('/api/projects/p1')
        .send({ name:'new-name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('new-name');
    });

    test('404 — when project does not belong to user', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);
      const res = await supertest(app).put('/api/projects/other').send({ name:'x' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/projects/:id ─────────────────────────────────────────────
  describe('DELETE /api/projects/:id', () => {
    test('200 — deletes project and returns deleted:true', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id:'p1', userId:'test-user-123' });
      mockPrisma.project.delete.mockResolvedValue({});
      const res = await supertest(app).delete('/api/projects/p1');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    test('404 — when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);
      const res = await supertest(app).delete('/api/projects/missing');
      expect(res.status).toBe(404);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DeploymentController — REST API', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ── GET /api/deployments ─────────────────────────────────────────────────
  describe('GET /api/deployments', () => {
    test('200 — returns deployments for user', async () => {
      const deployments = [
        { id:'d1', status:'SUCCESS', framework:'go',   isBackend:true,  project:{ name:'api' } },
        { id:'d2', status:'FAILED',  framework:'vite', isBackend:false, project:{ name:'web' } },
      ];
      mockPrisma.deployment.findMany.mockResolvedValue(deployments);
      const res = await supertest(app).get('/api/deployments');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    test('200 — filters by projectId when provided', async () => {
      mockPrisma.deployment.findMany.mockResolvedValue([]);
      await supertest(app).get('/api/deployments?projectId=p1');
      expect(mockPrisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId:'p1' }) })
      );
    });
  });

  // ── GET /api/deployments/:id ─────────────────────────────────────────────
  describe('GET /api/deployments/:id', () => {
    test('200 — returns deployment with project relation', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({
        id:'d1', status:'BUILDING', framework:'nextjs', isBackend:true,
        buildLog:'🔍 Detecting...', project:{ name:'my-app' },
      });
      const res = await supertest(app).get('/api/deployments/d1');
      expect(res.status).toBe(200);
      expect(res.body.framework).toBe('nextjs');
      expect(res.body.isBackend).toBe(true);
      expect(res.body.project.name).toBe('my-app');
    });

    test('404 — when deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      const res = await supertest(app).get('/api/deployments/missing');
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/deployments/github ─────────────────────────────────────────
  describe('POST /api/deployments/github', () => {
    test('201 — queues a GitHub deployment', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id:'p1', userId:'test-user-123', repoUrl:'https://github.com/user/repo',
        framework:'go', isBackend:true, nodeVersion:'20', envVars:{},
      });
      mockPrisma.deployment.create.mockResolvedValue({
        id:'d1', status:'QUEUED', source:'GITHUB', framework:'go', isBackend:true,
      });

      const res = await supertest(app)
        .post('/api/deployments/github')
        .send({ projectId:'p1', repoUrl:'https://github.com/user/repo', branch:'main' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('QUEUED');
      expect(mockQueue.add).toHaveBeenCalledWith('deploy',
        expect.objectContaining({ source:'GITHUB', isBackend:true })
      );
    });

    test('400 — when projectId is missing', async () => {
      const res = await supertest(app)
        .post('/api/deployments/github')
        .send({ repoUrl:'https://github.com/user/repo' });
      expect(res.status).toBe(400);
    });

    test('404 — when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);
      const res = await supertest(app)
        .post('/api/deployments/github')
        .send({ projectId:'nonexistent', repoUrl:'https://github.com/user/repo' });
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/deployments/:id/redeploy ───────────────────────────────────
  describe('POST /api/deployments/:id/redeploy', () => {
    test('201 — creates new deployment from original', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({
        id:'d1', projectId:'p1', source:'GITHUB', branch:'main',
        framework:'go', isBackend:true, userId:'test-user-123',
        project:{ repoUrl:'https://github.com/u/r', nodeVersion:'20', envVars:{} },
      });
      mockPrisma.deployment.create.mockResolvedValue({ id:'d2', status:'QUEUED' });

      const res = await supertest(app).post('/api/deployments/d1/redeploy');
      expect(res.status).toBe(201);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    test('404 — when original deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      const res = await supertest(app).post('/api/deployments/missing/redeploy');
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/deployments/:id (cancel) ─────────────────────────────────
  describe('DELETE /api/deployments/:id', () => {
    test('200 — cancels QUEUED deployment', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({ id:'d1', status:'QUEUED', userId:'test-user-123' });
      mockPrisma.deployment.update.mockResolvedValue({ id:'d1', status:'CANCELLED' });

      const res = await supertest(app).delete('/api/deployments/d1');
      expect(res.status).toBe(200);
      expect(res.body.cancelled).toBe(true);
    });

    test('400 — cannot cancel SUCCESS deployment', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({ id:'d1', status:'SUCCESS', userId:'test-user-123' });
      const res = await supertest(app).delete('/api/deployments/d1');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cancel');
    });

    test('404 — when deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      const res = await supertest(app).delete('/api/deployments/missing');
      expect(res.status).toBe(404);
    });
  });
});
