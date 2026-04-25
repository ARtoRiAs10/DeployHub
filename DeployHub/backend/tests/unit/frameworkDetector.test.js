'use strict';
/**
 * TDD — Unit tests for src/services/frameworkDetector.js
 *
 * Tests every detection branch directly without going through detector/index.
 * All non-curated framework paths (Go scanner, Python, Node, LLM merge).
 */
const { detectFramework, STATIC_FRAMEWORKS, SERVER_FRAMEWORKS } = require('../../src/services/frameworkDetector');
const { makeTempRepo, pkg } = require('../fixtures/fsHelper');

describe('frameworkDetector: detectFramework()', () => {

  describe('Dockerfile detection', () => {
    test('returns docker framework when Dockerfile present', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'Dockerfile': 'FROM alpine\nCMD ["sh"]' });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('docker');
        expect(r.isBackend).toBe(true);
        expect(r.hasDockerfile).toBe(true);
      } finally { await cleanup(); }
    });
  });

  describe('Go detection with main-package scanning', () => {
    test('detects go.mod → go framework, isBackend=true', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'main.go': 'package main\nfunc main() {}',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('go');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8080);
      } finally { await cleanup(); }
    });

    test('scans for nested main package in ./cmd', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'cmd/main.go': 'package main\nfunc main() {}',
        'internal/lib.go': 'package internal\n',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.goMainPkg).toBe('cmd');
        expect(r.buildCommand).toContain('./cmd');
        expect(r.buildCommand).not.toContain('./...');
      } finally { await cleanup(); }
    });

    test('buildCommand always set for Go (never undefined)', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'main.go': 'package main\nfunc main() {}',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.buildCommand).toBeTruthy();
        expect(r.buildCommand).toMatch(/^CGO_ENABLED=0 GOOS=linux go build/);
      } finally { await cleanup(); }
    });
  });

  describe('Rust detection', () => {
    test('detects Cargo.toml → rust, reads binary name', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'Cargo.toml': '[package]\nname = "redis_server"\nversion = "0.1.0"\n',
        'src/main.rs': 'fn main() {}',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('rust');
        expect(r.isBackend).toBe(true);
        expect(r.entryPoint).toBe('redis_server');
        expect(r.port).toBe(8080);
      } finally { await cleanup(); }
    });

    test('defaults to "app" when Cargo.toml lacks name', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'Cargo.toml': '[package]\nversion = "0.1.0"\n',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('rust');
        expect(r.entryPoint).toBe('app');
      } finally { await cleanup(); }
    });
  });

  describe('Python detection', () => {
    test('detects FastAPI from requirements.txt', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'fastapi>=0.100.0\nuvicorn\n',
        'main.py': 'from fastapi import FastAPI\napp = FastAPI()',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('fastapi');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
        expect(r.entryPoint).toBe('main.py');
        expect(r.startCommand).toContain('uvicorn main:app');
      } finally { await cleanup(); }
    });

    test('detects Flask from requirements.txt', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Flask==3.0.0\ngunicorn\n',
        'app.py': 'from flask import Flask',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('flask');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
        expect(r.entryPoint).toBe('app.py');
      } finally { await cleanup(); }
    });

    test('detects Django from requirements.txt', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Django==5.0\ngunicorn\n',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('django');
        expect(r.isBackend).toBe(true);
        expect(r.buildCommand).toContain('collectstatic');
      } finally { await cleanup(); }
    });

    test('detects generic Python when no known web framework', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'requirements.txt': 'numpy\npandas\n',
        'main.py': 'import numpy',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('python');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(8000);
      } finally { await cleanup(); }
    });

    test('detects from pyproject.toml', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'pyproject.toml': '[tool.poetry.dependencies]\nfastapi = "*"\nuvicorn = "*"\n',
        'main.py': 'from fastapi import FastAPI',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('fastapi');
      } finally { await cleanup(); }
    });
  });

  describe('Node.js detection', () => {
    test('detects Next.js → isBackend=true (SSR)', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.nextjs() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('nextjs');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(3000);
      } finally { await cleanup(); }
    });

    test('detects Nuxt → isBackend=true (SSR)', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.nuxt() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('nuxt');
        expect(r.isBackend).toBe(true);
      } finally { await cleanup(); }
    });

    test('detects Vite → isBackend=false (static)', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vite() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects Vue CLI → isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vuecli() });
      try {
        const r = await detectFramework(dir);
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects Express → isBackend=true', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'package.json': pkg.express(),
        'index.js': 'const express = require("express");',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('node-backend');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(3000);
      } finally { await cleanup(); }
    });

    test('detects SvelteKit SSR → isBackend=true', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltekit() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('sveltekit');
        expect(r.isBackend).toBe(true);
      } finally { await cleanup(); }
    });

    test('detects SvelteKit static → isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltestatic() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('sveltekit-static');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects CRA → isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.cra() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('cra');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects Gatsby → isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.gatsby() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('gatsby');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });

    test('detects Astro → isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.astro() });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('astro');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });
  });

  describe('Static HTML detection', () => {
    test('index.html without package.json → static, isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'index.html': '<!DOCTYPE html>' });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('static');
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });
  });

  describe('PHP detection', () => {
    test('composer.json → php, isBackend=true', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'composer.json': '{"require":{"php":"^8.0"}}',
      });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('php');
        expect(r.isBackend).toBe(true);
        expect(r.port).toBe(80);
      } finally { await cleanup(); }
    });
  });

  describe('LLM fallback (no OPENROUTER_API_KEY)', () => {
    test('returns static default when project is completely unrecognised', async () => {
      delete process.env.OPENROUTER_API_KEY;
      const { dir, cleanup } = await makeTempRepo({ 'README.md': '# Unknown' });
      try {
        const r = await detectFramework(dir);
        expect(r.framework).toBe('static');
        expect(r.detectionMethod).toBe('static');
      } finally { await cleanup(); }
    });
  });
});

describe('frameworkDetector: framework set exports', () => {
  test('STATIC_FRAMEWORKS contains expected entries', () => {
    expect(STATIC_FRAMEWORKS.has('vite')).toBe(true);
    expect(STATIC_FRAMEWORKS.has('cra')).toBe(true);
    expect(STATIC_FRAMEWORKS.has('gatsby')).toBe(true);
    expect(STATIC_FRAMEWORKS.has('static')).toBe(true);
    expect(STATIC_FRAMEWORKS.has('nextjs')).toBe(false);
    expect(STATIC_FRAMEWORKS.has('go')).toBe(false);
  });

  test('SERVER_FRAMEWORKS contains expected entries', () => {
    expect(SERVER_FRAMEWORKS.has('nextjs')).toBe(true);
    expect(SERVER_FRAMEWORKS.has('nuxt')).toBe(true);
    expect(SERVER_FRAMEWORKS.has('go')).toBe(true);
    expect(SERVER_FRAMEWORKS.has('fastapi')).toBe(true);
    expect(SERVER_FRAMEWORKS.has('vite')).toBe(false);
    expect(SERVER_FRAMEWORKS.has('static')).toBe(false);
  });
});
