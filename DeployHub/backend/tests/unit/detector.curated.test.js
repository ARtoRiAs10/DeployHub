'use strict';
/**
 * TDD — Unit tests for src/services/detector/curated.js
 *
 * Tests are grouped by framework. Each test:
 *   1. Arranges a temp directory with the exact files that framework needs
 *   2. Acts by calling detectFromCuratedList()
 *   3. Asserts the returned detection object is correct
 */
const { detectFromCuratedList } = require('../../src/services/detector/curated');
const { makeTempRepo, pkg }     = require('../fixtures/fsHelper');

// ─────────────────────────────────────────────────────────────────────────────
describe('curated detector — static frontends (→ S3)', () => {

  describe('Vite / React+Vite / Vue3+Vite / Solid+Vite', () => {
    test('detects @vitejs/plugin-react as vite', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vite() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('dist');
        expect(r.buildCommand).toBe('vite build');
      } finally { await cleanup(); }
    });

    test('detects @vitejs/plugin-vue (Vue 3 + Vite) as vite → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vue3vite() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('dist');
      } finally { await cleanup(); }
    });

    test('detects @vue/cli-service (Vue 2 CLI) as vite → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vuecli() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('dist');
      } finally { await cleanup(); }
    });

    test('detects react-scripts (CRA) as cra → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.cra() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('cra');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('build');
      } finally { await cleanup(); }
    });

    test('detects gatsby → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.gatsby() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('gatsby');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('public');
      } finally { await cleanup(); }
    });

    test('detects astro → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.astro() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('astro');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('dist');
      } finally { await cleanup(); }
    });

    test('detects plain index.html (no package.json) as static → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'index.html': '<html></html>' });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('static');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects @sveltejs/adapter-static as sveltekit-static → S3', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltestatic() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('sveltekit-static');
        expect(r.isBackend).toBe(false);
        expect(r.outputDir).toBe('build');
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('SSR frameworks — MUST be isBackend=true (→ EC2)', () => {

    test('Next.js isBackend=true (SSR requires Node server, NOT S3)', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.nextjs() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('nextjs');
        expect(r.isBackend).toBe(true);   // ← Critical: was false (bug fixed)
        expect(r.outputDir).toBe('.next');
        expect(r.startCommand).toBe('node server.js');
        expect(r.port).toBe(3000);
      } finally { await cleanup(); }
    });

    test('Nuxt isBackend=true (SSR requires Node server, NOT S3)', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.nuxt() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('nuxt');
        expect(r.isBackend).toBe(true);   // ← Critical: was false (bug fixed)
        expect(r.outputDir).toBe('.output');
        expect(r.startCommand).toBe('node server/index.mjs');
      } finally { await cleanup(); }
    });

    test('SvelteKit SSR isBackend=true', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltekit() });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('sveltekit');
        expect(r.isBackend).toBe(true);
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Node backends (→ EC2)', () => {

    test('detects Express as node-backend', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.express(), 'index.js': 'const express=require("express");' });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('node-backend');
        expect(r.isBackend).toBe(true);
        expect(r.entryPoint).toBe('index.js');
        expect(r.port).toBe(3000);
      } finally { await cleanup(); }
    });

    test('detects Fastify as node-backend', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.fastify(), 'server.js': '' });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('node-backend');
        expect(r.isBackend).toBe(true);
        expect(r.entryPoint).toBe('server.js');
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Python frameworks (→ EC2)', () => {

    test('detects FastAPI', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'fastapi\nuvicorn\nhttpx\n',
        'main.py': 'from fastapi import FastAPI\napp = FastAPI()',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('fastapi');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
        expect(r.startCommand).toContain('uvicorn');
        expect(r.entryPoint).toBe('main.py');
      } finally { await cleanup(); }
    });

    test('detects Flask', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Flask==3.0.0\ngunicorn\n',
        'app.py': 'from flask import Flask\napp = Flask(__name__)',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('flask');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
        expect(r.startCommand).toContain('gunicorn');
        expect(r.entryPoint).toBe('app.py');
      } finally { await cleanup(); }
    });

    test('detects Django', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Django==5.0\ngunicorn\n',
        'manage.py': 'import django',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('django');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
        expect(r.buildCommand).toContain('collectstatic');
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Go framework (→ EC2)', () => {

    test('detects Go with main.go at root (buildTarget = ".")', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module github.com/test/app\n\ngo 1.22\n',
        'main.go': 'package main\nfunc main() {}',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('go');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8080);
        expect(r.buildCommand).toContain('go build');
        expect(r.buildCommand).toContain('-o main');
        expect(r.buildCommand).not.toContain('./...');  // must NOT use ./...
      } finally { await cleanup(); }
    });

    test('detects Go with main in ./cmd subdirectory (redis_clone pattern)', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module github.com/ARtorias742/Redis\n\ngo 1.22\n',
        'cmd/main.go': 'package main\nfunc main() {}',
        'internal/server/server.go': 'package server\n',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('go');
        expect(r.isBackend).toBe(true);
        expect(r.goMainPkg).toBe('cmd');
        expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main ./cmd');
      } finally { await cleanup(); }
    });

    test('detects Go with main in ./cmd/server subdir', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'cmd/server/main.go': 'package main\nfunc main() {}',
        'pkg/lib.go': 'package pkg\n',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.goMainPkg).toBe('cmd/server');
        expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server');
      } finally { await cleanup(); }
    });

    test('Go buildCommand never uses ./... (prevents "cannot write multiple packages" error)', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'cmd/main.go': 'package main\nfunc main() {}',
        'internal/store/store.go': 'package store\n',
        'internal/config/config.go': 'package config\n',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.buildCommand).not.toContain('./...');
        expect(r.buildCommand).toContain('./cmd');
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Rust framework (→ EC2)', () => {

    test('detects Rust project', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'Cargo.toml': '[package]\nname = "my_server"\nversion = "0.1.0"\n',
        'src/main.rs': 'fn main() {}',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('rust');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8080);
        expect(r.entryPoint).toBe('my_server');
        expect(r.buildCommand).toBe('cargo build --release');
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Dockerfile (→ EC2)', () => {

    test('detects existing Dockerfile as docker framework', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'Dockerfile': 'FROM alpine\nCMD ["sh"]',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r.framework).toBe('docker');
        expect(r.isBackend).toBe(true);
        expect(r.hasDockerfile).toBe(true);
      } finally { await cleanup(); }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('Monorepo / subdirectory detection', () => {

    test('finds project in a subdirectory when root has no known files', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'README.md': '# Monorepo',
        'api/go.mod': 'module example.com/api\n\ngo 1.22\n',
        'api/main.go': 'package main\nfunc main() {}',
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r).not.toBeNull();
        expect(r.framework).toBe('go');
        expect(r.projectRoot).toContain('api');
      } finally { await cleanup(); }
    });

    test('detects frontend in a subdirectory', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'README.md': '# Monorepo',
        'web/package.json': JSON.stringify(pkg.vite()),
      });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r).not.toBeNull();
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('returns null for completely unknown project', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'README.md': '# Unknown project' });
      try {
        const r = await detectFromCuratedList(dir);
        expect(r).toBeNull();
      } finally { await cleanup(); }
    });
  });
});
