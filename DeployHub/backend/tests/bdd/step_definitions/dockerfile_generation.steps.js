'use strict';
/**
 * BDD Step Definitions — dockerfile_generation.feature
 */
const { defineFeature, loadFeature } = require('jest-cucumber');
const path = require('path');
const fs   = require('fs-extra');
const { generateDockerfile, TEMPLATES } = require('../../../src/services/dockerfileGenerator');
const { makeTempRepo } = require('../../fixtures/fsHelper');

const feature = loadFeature(
  path.join(__dirname, '../features/dockerfile_generation.feature')
);

const BASE_OPTS = { nodeVersion:'20', buildCommand:'npm run build', outputDir:'dist', entryPoint:'index.js', startCommand:'node index.js', port:3000 };

let dockerfileContent, generatorResult, repoDir, cleanup, originalContent;

async function resetState() {
  if (cleanup) { await cleanup(); cleanup = null; }
  dockerfileContent = null; generatorResult = null;
  repoDir = null; originalContent = null;
}

defineFeature(feature, test => {
  afterEach(async () => { await resetState(); });

  // ── Vite ─────────────────────────────────────────────────────────────────
  test('Vite app Dockerfile uses nginx with correct output dir', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "vite" with outputDir "dist"/, () => {
      dockerfileContent = TEMPLATES.vite({ ...BASE_OPTS, outputDir:'dist' });
    });
    then(/the Dockerfile should start with "FROM node"/, () => expect(dockerfileContent.trim()).toMatch(/^FROM node/));
    and(/the Dockerfile should contain "AS builder"/, () => expect(dockerfileContent).toContain('AS builder'));
    and(/the Dockerfile should contain "FROM nginx:alpine AS runner"/, () => expect(dockerfileContent).toContain('FROM nginx:alpine AS runner'));
    and(/the Dockerfile should contain "COPY --from=builder \/app\/dist \/usr\/share\/nginx\/html"/, () => expect(dockerfileContent).toContain('COPY --from=builder /app/dist /usr/share/nginx/html'));
    and(/the Dockerfile should contain "EXPOSE 80"/, () => expect(dockerfileContent).toContain('EXPOSE 80'));
  });

  // ── CRA ──────────────────────────────────────────────────────────────────
  test('CRA app Dockerfile copies build/ to nginx', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "cra" with outputDir "build"/, () => {
      dockerfileContent = TEMPLATES.cra({ ...BASE_OPTS, outputDir:'build' });
    });
    then(/the Dockerfile should contain "COPY --from=builder \/app\/build \/usr\/share\/nginx\/html"/, () => {
      expect(dockerfileContent).toContain('COPY --from=builder /app/build /usr/share/nginx/html');
    });
  });

  // ── Next.js ───────────────────────────────────────────────────────────────
  test('Next.js Dockerfile runs standalone node server', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "nextjs"/, () => {
      dockerfileContent = TEMPLATES.nextjs(BASE_OPTS);
    });
    then(/the Dockerfile should contain "\.next\/standalone"/, () => expect(dockerfileContent).toContain('.next/standalone'));
    and(/the Dockerfile should contain "\.next\/static"/, () => expect(dockerfileContent).toContain('.next/static'));
    and(/the Dockerfile should contain the node server\.js startup command/, () => expect(dockerfileContent).toContain('CMD ["node","server.js"]'));
    and(/the Dockerfile should contain "EXPOSE 3000"/, () => expect(dockerfileContent).toContain('EXPOSE 3000'));
  });

  // ── Nuxt ─────────────────────────────────────────────────────────────────
  test('Nuxt Dockerfile runs node server', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "nuxt"/, () => {
      dockerfileContent = TEMPLATES.nuxt(BASE_OPTS);
    });
    then(/the Dockerfile should contain "COPY --from=builder \/app\/\.output \.\/"/, () => expect(dockerfileContent).toContain('COPY --from=builder /app/.output ./'));
    and(/the Dockerfile should contain the nuxt server startup command/, () => expect(dockerfileContent).toContain('CMD ["node","server/index.mjs"]'));
  });

  // ── Go ───────────────────────────────────────────────────────────────────
  test('Go Dockerfile uses exact build target from buildCommand', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "go" with buildCommand "CGO_ENABLED=0 GOOS=linux go build -o main \.\/cmd"/, () => {
      dockerfileContent = TEMPLATES.go({ ...BASE_OPTS, buildCommand:'CGO_ENABLED=0 GOOS=linux go build -o main ./cmd', port:8080 });
    });
    then(/the Dockerfile should contain "RUN CGO_ENABLED=0 GOOS=linux go build -o main \.\/cmd"/, () => {
      expect(dockerfileContent).toContain('RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd');
    });
    and(/the Dockerfile should NOT contain "\.\/\.\.\."/, () => expect(dockerfileContent).not.toContain('./...'));
    and(/the Dockerfile should contain "FROM alpine:latest"/, () => expect(dockerfileContent).toContain('FROM alpine:latest'));
    and(/the Dockerfile should contain "EXPOSE 8080"/, () => expect(dockerfileContent).toContain('EXPOSE 8080'));
    and(/the Dockerfile should contain the go binary startup command/, () => expect(dockerfileContent).toContain('CMD ["./main"]'));
  });

  // ── FastAPI ───────────────────────────────────────────────────────────────
  test('FastAPI Dockerfile installs from requirements.txt', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "fastapi"/, () => {
      dockerfileContent = TEMPLATES.fastapi({ ...BASE_OPTS, startCommand:'uvicorn main:app --host 0.0.0.0 --port 8000', port:8000 });
    });
    then(/the Dockerfile should contain "FROM python:3\.11-slim"/, () => expect(dockerfileContent).toContain('FROM python:3.11-slim'));
    and(/the Dockerfile should contain "pip install --no-cache-dir -r requirements\.txt"/, () => expect(dockerfileContent).toContain('pip install --no-cache-dir -r requirements.txt'));
    and(/the Dockerfile should contain "pip install --no-cache-dir uvicorn"/, () => expect(dockerfileContent).toContain('pip install --no-cache-dir uvicorn'));
    and(/the Dockerfile should contain "EXPOSE 8000"/, () => expect(dockerfileContent).toContain('EXPOSE 8000'));
  });

  // ── Flask ─────────────────────────────────────────────────────────────────
  test('Flask Dockerfile uses gunicorn', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "flask"/, () => {
      dockerfileContent = TEMPLATES.flask({ ...BASE_OPTS, startCommand:'gunicorn app:app --bind 0.0.0.0:8000 --workers 2', port:8000 });
    });
    then(/the Dockerfile should contain "FROM python:3\.11-slim"/, () => expect(dockerfileContent).toContain('FROM python:3.11-slim'));
    and(/the Dockerfile should contain "gunicorn"/, () => expect(dockerfileContent).toContain('gunicorn'));
    and(/the Dockerfile should contain "EXPOSE 8000"/, () => expect(dockerfileContent).toContain('EXPOSE 8000'));
  });

  // ── Rust ─────────────────────────────────────────────────────────────────
  test('Rust Dockerfile builds release binary', ({ given, when, then, and }) => {
    given(/I request a Dockerfile for framework "rust" with entryPoint "my_server"/, () => {
      dockerfileContent = TEMPLATES.rust({ ...BASE_OPTS, entryPoint:'my_server', port:8080 });
    });
    then(/the Dockerfile should contain "FROM rust:1\.75-slim AS builder"/, () => expect(dockerfileContent).toContain('FROM rust:1.75-slim AS builder'));
    and(/the Dockerfile should contain "cargo build --release"/, () => expect(dockerfileContent).toContain('cargo build --release'));
    and(/the Dockerfile should contain "my_server"/, () => expect(dockerfileContent).toContain('my_server'));
    and(/the Dockerfile should contain "EXPOSE 8080"/, () => expect(dockerfileContent).toContain('EXPOSE 8080'));
  });

  // ── Existing Dockerfile not overwritten ───────────────────────────────────
  test('Existing Dockerfile is not overwritten', ({ given, when, then, and }) => {
    given(/a repository already has a "Dockerfile"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'Dockerfile': 'FROM alpine\n# my custom dockerfile\n' }));
      originalContent = 'FROM alpine\n# my custom dockerfile\n';
    });
    when(/I call generateDockerfile for framework "vite"/, async () => {
      generatorResult = await generateDockerfile(repoDir, { framework:'vite', ...BASE_OPTS });
    });
    then(/the result should have generated equal to false/, () => expect(generatorResult.generated).toBe(false));
    and(/the existing Dockerfile should be unchanged/, async () => {
      const current = await fs.readFile(require('path').join(repoDir, 'Dockerfile'), 'utf8');
      expect(current).toBe(originalContent);
    });
  });

  // ── Node version parameterised ────────────────────────────────────────────
  test('Node version is parameterised in Node.js templates', ({ given, when, then }) => {
    given(/I request a Dockerfile for framework "vite" with nodeVersion "18"/, () => {
      dockerfileContent = TEMPLATES.vite({ ...BASE_OPTS, nodeVersion:'18' });
    });
    then(/the Dockerfile should contain "FROM node:18-alpine"/, () => expect(dockerfileContent).toContain('FROM node:18-alpine'));
  });
});
