'use strict';
/**
 * BDD Step Definitions — framework_detection.feature
 * Uses jest-cucumber to bind Gherkin steps to real detector calls.
 */
const { defineFeature, loadFeature } = require('jest-cucumber');
const path   = require('path');
const { detect }                    = require('../../../src/services/detector');
const { detectFromCuratedList }     = require('../../../src/services/detector/curated');
const { TEMPLATES }                 = require('../../../src/services/dockerfileGenerator');
const { makeTempRepo, pkg }         = require('../../fixtures/fsHelper');

const feature = loadFeature(
  path.join(__dirname, '../features/framework_detection.feature')
);

// ── Shared state per scenario ─────────────────────────────────────────────────
let repoDir, cleanup, detectionResult;

async function resetState() {
  if (cleanup) { await cleanup(); cleanup = null; }
  repoDir = null; detectionResult = null;
}

defineFeature(feature, test => {

  afterEach(async () => { await resetState(); });

  // ─────────────────── Vite React ───────────────────────────────────────────
  test('Deploying a Vite React app routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "vite" and "@vitejs\/plugin-react" dependencies/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.vite() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "vite"/, () => expect(detectionResult.framework).toBe('vite'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and(/the output directory should be "dist"/, () => expect(detectionResult.outputDir).toBe('dist'));
    and('isBackend should be false', () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── Vue 3 + Vite ────────────────────────────────────────
  test('Deploying a Vue 3 + Vite app routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "vue" and "@vitejs\/plugin-vue" dependencies/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.vue3vite() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "vite"/, () => expect(detectionResult.framework).toBe('vite'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and('isBackend should be false', () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── Vue CLI ─────────────────────────────────────────────
  test('Deploying a Vue CLI (Vue 2) app routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "@vue\/cli-service" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.vuecli() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "vite"/, () => expect(detectionResult.framework).toBe('vite'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and('isBackend should be false', () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── CRA ─────────────────────────────────────────────────
  test('Deploying a Create React App routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "react-scripts" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.cra() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "cra"/, () => expect(detectionResult.framework).toBe('cra'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and(/the output directory should be "build"/, () => expect(detectionResult.outputDir).toBe('build'));
  });

  // ─────────────────── Static HTML ─────────────────────────────────────────
  test('Deploying a static HTML site routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing only an "index.html" file/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'index.html': '<html></html>' }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "static"/, () => expect(detectionResult.framework).toBe('static'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── Gatsby ──────────────────────────────────────────────
  test('Deploying a Gatsby site routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "gatsby" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.gatsby() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "gatsby"/, () => expect(detectionResult.framework).toBe('gatsby'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and(/the output directory should be "public"/, () => expect(detectionResult.outputDir).toBe('public'));
  });

  // ─────────────────── Astro ───────────────────────────────────────────────
  test('Deploying an Astro site routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "astro" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.astro() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "astro"/, () => expect(detectionResult.framework).toBe('astro'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── Next.js → EC2 ───────────────────────────────────────
  test('Deploying a Next.js app routes to EC2 not S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "next" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.nextjs() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "nextjs"/, () => expect(detectionResult.framework).toBe('nextjs'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and('isBackend should be true', () => expect(detectionResult.isBackend).toBe(true));
    and(/the start command should be "node server.js"/, () => expect(detectionResult.startCommand).toBe('node server.js'));
  });

  // ─────────────────── Nuxt → EC2 ──────────────────────────────────────────
  test('Deploying a Nuxt app routes to EC2 not S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "nuxt" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.nuxt() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "nuxt"/, () => expect(detectionResult.framework).toBe('nuxt'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and('isBackend should be true', () => expect(detectionResult.isBackend).toBe(true));
    and(/the start command should be "node server\/index.mjs"/, () => expect(detectionResult.startCommand).toBe('node server/index.mjs'));
  });

  // ─────────────────── SvelteKit SSR → EC2 ─────────────────────────────────
  test('Deploying a SvelteKit SSR app routes to EC2', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "@sveltejs\/kit" dependency but no static adapter/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltekit() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "sveltekit"/, () => expect(detectionResult.framework).toBe('sveltekit'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and('isBackend should be true', () => expect(detectionResult.isBackend).toBe(true));
  });

  // ─────────────────── SvelteKit static → S3 ───────────────────────────────
  test('Deploying a SvelteKit static app routes to S3', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "@sveltejs\/kit" and "@sveltejs\/adapter-static" dependencies/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.sveltestatic() }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "sveltekit-static"/, () => expect(detectionResult.framework).toBe('sveltekit-static'));
    and(/the deploy target should be "S3"/, () => expect(detectionResult.isBackend).toBe(false));
    and('isBackend should be false', () => expect(detectionResult.isBackend).toBe(false));
  });

  // ─────────────────── Express → EC2 ───────────────────────────────────────
  test('Deploying an Express API routes to EC2', ({ given, when, then, and }) => {
    given(/a repository containing a "package.json" with "express" dependency/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({ 'package.json': pkg.express(), 'index.js': '' }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "node-backend"/, () => expect(detectionResult.framework).toBe('node-backend'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and('isBackend should be true', () => expect(detectionResult.isBackend).toBe(true));
  });

  // ─────────────────── FastAPI → EC2 ───────────────────────────────────────
  test('Deploying a FastAPI service routes to EC2', ({ given, when, then, and }) => {
    given(/a repository with "requirements.txt" containing "fastapi" and "main.py"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'requirements.txt': 'fastapi\nuvicorn\n',
        'main.py': 'from fastapi import FastAPI\napp=FastAPI()',
      }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "fastapi"/, () => expect(detectionResult.framework).toBe('fastapi'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and(/the port should be 8000/, () => expect(detectionResult.port).toBe(8000));
    and(/the start command should contain "uvicorn"/, () => expect(detectionResult.startCommand).toContain('uvicorn'));
  });

  // ─────────────────── Flask → EC2 ─────────────────────────────────────────
  test('Deploying a Flask service routes to EC2', ({ given, when, then, and }) => {
    given(/a repository with "requirements.txt" containing "Flask" and "app.py"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Flask\ngunicorn\n',
        'app.py': 'from flask import Flask\napp=Flask(__name__)',
      }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "flask"/, () => expect(detectionResult.framework).toBe('flask'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and(/the port should be 8000/, () => expect(detectionResult.port).toBe(8000));
  });

  // ─────────────────── Django → EC2 ────────────────────────────────────────
  test('Deploying a Django service routes to EC2', ({ given, when, then, and }) => {
    given(/a repository with "requirements.txt" containing "Django"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'requirements.txt': 'Django==5.0\ngunicorn\n',
        'manage.py': 'import django',
      }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "django"/, () => expect(detectionResult.framework).toBe('django'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and(/the build command should contain "collectstatic"/, () => expect(detectionResult.buildCommand).toContain('collectstatic'));
  });

  // ─────────────────── Go nested main → EC2 ────────────────────────────────
  test('Deploying a Go app with main package in ./cmd subdirectory', ({ given, when, then, and }) => {
    given(/a Go repository with "go.mod" and main package in "cmd\/main.go"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'go.mod': 'module github.com/ARtorias742/Redis\n\ngo 1.22\n',
        'cmd/main.go': 'package main\nfunc main() {}',
        'internal/server/server.go': 'package server\n',
      }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "go"/, () => expect(detectionResult.framework).toBe('go'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and(/the goMainPkg should be "cmd"/, () => expect(detectionResult.goMainPkg).toBe('cmd'));
    and(/the build command should be "CGO_ENABLED=0 GOOS=linux go build -o main .\/cmd"/, () => {
      expect(detectionResult.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main ./cmd');
    });
    and(/the build command should NOT contain ".\/\.\.\."/, () => {
      expect(detectionResult.buildCommand).not.toContain('./...');
    });
  });

  // ─────────────────── Go Dockerfile ───────────────────────────────────────
  test('Go build command never uses ./... to prevent multi-package error', ({ given, when, then, and }) => {
    let dockerfileContent;
    given(/a Go repository with multiple packages and main in "cmd\/"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'go.mod': 'module example.com/app\n\ngo 1.22\n',
        'cmd/main.go': 'package main\nfunc main() {}',
        'internal/store/store.go': 'package store\n',
      }));
    });
    when(/the Dockerfile is generated for this project/, async () => {
      const detected = await detectFromCuratedList(repoDir);
      dockerfileContent = TEMPLATES.go({ buildCommand: detected.buildCommand });
    });
    then(/the Dockerfile RUN build line should contain ".\/cmd"/, () => {
      expect(dockerfileContent).toContain('./cmd');
    });
    and(/the Dockerfile RUN build line should NOT contain ".\/\.\.\."/, () => {
      expect(dockerfileContent).not.toContain('./...');
    });
  });

  // ─────────────────── Rust ────────────────────────────────────────────────
  test('Deploying a Rust service routes to EC2', ({ given, when, then, and }) => {
    given(/a repository with "Cargo.toml" defining package name "my_server"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'Cargo.toml': '[package]\nname = "my_server"\nversion = "0.1.0"\n',
        'src/main.rs': 'fn main() {}',
      }));
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "rust"/, () => expect(detectionResult.framework).toBe('rust'));
    and(/the deploy target should be "EC2"/, () => expect(detectionResult.isBackend).toBe(true));
    and(/the entry point should be "my_server"/, () => expect(detectionResult.entryPoint).toBe('my_server'));
    and(/the port should be 8080/, () => expect(detectionResult.port).toBe(8080));
  });

  // ─────────────────── Monorepo ────────────────────────────────────────────
  test('Detecting a project in a subdirectory of a monorepo', ({ given, when, then, and }) => {
    given(/a monorepo with an Express API in the "api\/" subdirectory/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'README.md': '# Monorepo',
        'api/package.json': JSON.stringify(pkg.express()),
        'api/index.js': 'const express=require("express");',
      }));
    });
    when('the framework detector analyses the root repository', async () => {
      detectionResult = await detectFromCuratedList(repoDir);
    });
    then(/the detected framework should be "node-backend"/, () => expect(detectionResult.framework).toBe('node-backend'));
    and(/the project root should point to the "api" subdirectory/, () => expect(detectionResult.projectRoot).toMatch(/api$/));
  });

  // ─────────────────── deployhub.json override ─────────────────────────────
  test('deployhub.json config overrides auto-detection', ({ given, when, then, and }) => {
    given(/a repository containing both a "deployhub.json" and a "package.json" with "vite"/, async () => {
      ({ dir: repoDir, cleanup } = await makeTempRepo({
        'deployhub.json': { framework:'docker', isBackend:true },
        'package.json':   pkg.vite(),
      }));
    });
    given(/the "deployhub.json" specifies framework "docker" and isBackend true/, () => {
      // Already done above
    });
    when('the framework detector analyses the repository', async () => {
      detectionResult = await detect(repoDir);
    });
    then(/the detected framework should be "docker"/, () => expect(detectionResult.framework).toBe('docker'));
    and(/the detection method should be "config"/, () => expect(detectionResult.detectionMethod).toBe('config'));
  });
});
