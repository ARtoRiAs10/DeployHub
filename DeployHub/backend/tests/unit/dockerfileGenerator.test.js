'use strict';
/**
 * TDD — Unit tests for src/services/dockerfileGenerator.js
 *
 * Tests validate that each TEMPLATE produces a syntactically correct,
 * properly structured Dockerfile with the expected directives.
 */
const { generateDockerfile, TEMPLATES } = require('../../src/services/dockerfileGenerator');
const { makeTempRepo }                   = require('../fixtures/fsHelper');

// Helper: assert a Dockerfile string contains expected lines
function expectDockerfile(content, lines) {
  for (const line of lines) {
    expect(content).toContain(line);
  }
}

describe('Dockerfile templates', () => {

  const BASE = { nodeVersion:'20', buildCommand:'npm run build', outputDir:'dist', entryPoint:'index.js', startCommand:'node index.js', port:3000 };

  // ── Static frontends ────────────────────────────────────────────────────
  describe('vite template', () => {
    test('produces multi-stage build with nginx runner', () => {
      const df = TEMPLATES.vite(BASE);
      expectDockerfile(df, [
        'FROM node:20-alpine AS builder',
        'RUN npm ci',
        'RUN npm run build',
        'FROM nginx:alpine AS runner',
        'COPY --from=builder /app/dist /usr/share/nginx/html',
        'EXPOSE 80',
        'CMD ["nginx","-g","daemon off;"]',
      ]);
    });

    test('uses buildCommand from opts', () => {
      const df = TEMPLATES.vite({ ...BASE, buildCommand: 'pnpm build' });
      expect(df).toContain('RUN pnpm build');
    });
  });

  describe('cra template', () => {
    test('copies build/ to nginx html dir', () => {
      const df = TEMPLATES.cra(BASE);
      expect(df).toContain('COPY --from=builder /app/build /usr/share/nginx/html');
    });
  });

  describe('gatsby template', () => {
    test('copies public/ to nginx html dir', () => {
      const df = TEMPLATES.gatsby(BASE);
      expect(df).toContain('COPY --from=builder /app/public /usr/share/nginx/html');
    });
  });

  describe('astro template', () => {
    test('copies dist/ to nginx html dir', () => {
      const df = TEMPLATES.astro(BASE);
      expect(df).toContain('COPY --from=builder /app/dist /usr/share/nginx/html');
    });
  });

  describe('sveltekit-static template', () => {
    test('copies build/ to nginx html dir', () => {
      const df = TEMPLATES['sveltekit-static'](BASE);
      expect(df).toContain('COPY --from=builder /app/build /usr/share/nginx/html');
    });
  });

  describe('static template', () => {
    test('directly copies files into nginx html dir', () => {
      const df = TEMPLATES.static(BASE);
      expectDockerfile(df, [
        'FROM nginx:alpine',
        'COPY . /usr/share/nginx/html',
        'EXPOSE 80',
      ]);
      expect(df).not.toContain('AS builder');
    });
  });

  // ── SSR / Backend Node ───────────────────────────────────────────────────
  describe('nextjs template', () => {
    test('uses standalone output mode and starts node server.js', () => {
      const df = TEMPLATES.nextjs(BASE);
      expectDockerfile(df, [
        'COPY --from=builder /app/.next/standalone ./',
        'COPY --from=builder /app/.next/static ./.next/static',
        'EXPOSE 3000',
        'CMD ["node","server.js"]',
      ]);
    });

    test('injects standalone config when not present', () => {
      const df = TEMPLATES.nextjs(BASE);
      expect(df).toContain("standalone");
    });
  });

  describe('nuxt template', () => {
    test('copies .output and starts node server/index.mjs', () => {
      const df = TEMPLATES.nuxt(BASE);
      expectDockerfile(df, [
        'COPY --from=builder /app/.output ./',
        'EXPOSE 3000',
        'CMD ["node","server/index.mjs"]',
      ]);
    });
  });

  describe('sveltekit template', () => {
    test('builds and starts node build/index.js', () => {
      const df = TEMPLATES.sveltekit(BASE);
      expectDockerfile(df, [
        'COPY --from=builder /app/build ./build',
        'CMD ["node","build/index.js"]',
      ]);
    });
  });

  describe('node-backend template', () => {
    test('uses --omit=dev and starts specified entryPoint', () => {
      const df = TEMPLATES['node-backend']({ ...BASE, entryPoint: 'server.js' });
      expectDockerfile(df, [
        'RUN npm ci --omit=dev',
        'CMD ["node","server.js"]',
        'EXPOSE 3000',
      ]);
    });

    test('adds RUN build step when buildCommand is provided', () => {
      const df = TEMPLATES['node-backend']({ ...BASE, buildCommand: 'npm run build' });
      expect(df).toContain('RUN npm run build');
    });
  });

  // ── Python ───────────────────────────────────────────────────────────────
  describe('fastapi template', () => {
    test('installs from requirements.txt and starts uvicorn', () => {
      const df = TEMPLATES.fastapi({ ...BASE, startCommand:'uvicorn main:app --host 0.0.0.0 --port 8000', port:8000 });
      expectDockerfile(df, [
        'FROM python:3.11-slim',
        'pip install --no-cache-dir -r requirements.txt',
        'pip install --no-cache-dir uvicorn',
        'EXPOSE 8000',
        'uvicorn',
      ]);
    });
  });

  describe('flask template', () => {
    test('installs flask + gunicorn and starts gunicorn', () => {
      const df = TEMPLATES.flask({ ...BASE, startCommand:'gunicorn app:app --bind 0.0.0.0:8000 --workers 2', port:8000 });
      expectDockerfile(df, [
        'FROM python:3.11-slim',
        'pip install --no-cache-dir gunicorn flask',
        'EXPOSE 8000',
        'gunicorn',
      ]);
    });
  });

  describe('django template', () => {
    test('runs collectstatic and starts gunicorn', () => {
      const df = TEMPLATES.django({ ...BASE, buildCommand:'python manage.py collectstatic --noinput', startCommand:'gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2', port:8000 });
      expectDockerfile(df, [
        'FROM python:3.11-slim',
        'RUN python manage.py collectstatic --noinput',
        'gunicorn',
        'EXPOSE 8000',
      ]);
    });
  });

  // ── Systems ───────────────────────────────────────────────────────────────
  describe('go template', () => {
    test('uses buildCommand directly from opts (single source of truth)', () => {
      const df = TEMPLATES.go({ ...BASE, buildCommand:'CGO_ENABLED=0 GOOS=linux go build -o main ./cmd', port:8080 });
      expectDockerfile(df, [
        'FROM golang:1.22-alpine AS builder',
        'RUN go mod tidy && go mod download',
        'RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd',
        'FROM alpine:latest',
        'EXPOSE 8080',
        'CMD ["./main"]',
      ]);
    });

    test('falls back to "." when no buildCommand provided', () => {
      const df = TEMPLATES.go({ ...BASE, buildCommand: null, port:8080 });
      expect(df).toContain('go build -o main .');
    });

    test('NEVER uses ./... (causes "cannot write multiple packages" error)', () => {
      const df = TEMPLATES.go({ ...BASE, buildCommand:'CGO_ENABLED=0 GOOS=linux go build -o main ./cmd', port:8080 });
      expect(df).not.toContain('./...');
    });

    test('uses correct port 8080', () => {
      const df = TEMPLATES.go({ ...BASE, port:8080 });
      expect(df).toContain('EXPOSE 8080');
    });
  });

  describe('rust template', () => {
    test('builds release binary and runs it', () => {
      const df = TEMPLATES.rust({ ...BASE, entryPoint:'my_server', port:8080 });
      expectDockerfile(df, [
        'FROM rust:1.75-slim AS builder',
        'RUN cargo build --release',
        'COPY --from=builder /app/target/release/my_server ./app',
        'EXPOSE 8080',
        'CMD ["./app"]',
      ]);
    });
  });

  describe('php template', () => {
    test('uses php:8.2-apache and runs composer when present', () => {
      const df = TEMPLATES.php(BASE);
      expectDockerfile(df, [
        'FROM php:8.2-apache',
        'composer.json',
        'EXPOSE 80',
      ]);
    });
  });

  // ── generateDockerfile integration ───────────────────────────────────────
  describe('generateDockerfile()', () => {

    test('writes Dockerfile to disk and returns generated=true', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': '{}' });
      try {
        const result = await generateDockerfile(dir, { framework:'vite', ...BASE });
        expect(result.generated).toBe(true);
        const fs = require('fs-extra');
        const written = await fs.readFile(result.path, 'utf8');
        expect(written).toContain('FROM node:20-alpine AS builder');
      } finally { await cleanup(); }
    });

    test('returns generated=false if Dockerfile already exists', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'Dockerfile': 'FROM alpine' });
      try {
        const result = await generateDockerfile(dir, { framework:'vite', ...BASE });
        expect(result.generated).toBe(false);
      } finally { await cleanup(); }
    });

    test('falls back to genericFallback for unknown framework without OPENROUTER_API_KEY', async () => {
      delete process.env.OPENROUTER_API_KEY;
      const { dir, cleanup } = await makeTempRepo({});
      try {
        const result = await generateDockerfile(dir, { framework:'unknown-fw', nodeVersion:'20', port:3000 });
        expect(result.generated).toBe(true);
        const fs = require('fs-extra');
        const written = await fs.readFile(result.path, 'utf8');
        expect(written.trim().toUpperCase()).toMatch(/^FROM/);
      } finally { await cleanup(); }
    });
  });
});
