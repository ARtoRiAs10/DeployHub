'use strict';
/**
 * Integration tests — detector/index.js (full 3-layer pipeline)
 *
 * Layer 1: deployhub.json config
 * Layer 2: curated detection
 * Layer 3: LLM fallback (mocked)
 */
const { detect }        = require('../../src/services/detector');
const { makeTempRepo, pkg } = require('../fixtures/fsHelper');

describe('Detector pipeline: full layer traversal', () => {

  // ── Layer 1: deployhub.json ───────────────────────────────────────────────
  describe('Layer 1 — deployhub.json config file overrides everything', () => {

    test('respects framework override from deployhub.json', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'deployhub.json': { framework:'docker', isBackend:true },
        'package.json':   pkg.vite(),   // would normally detect as vite
      });
      try {
        const r = await detect(dir);
        expect(r.framework).toBe('docker');
        expect(r.detectionMethod).toBe('config');
      } finally { await cleanup(); }
    });

    test('deployhub.json isBackend=true overrides curated isBackend=false', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'deployhub.json': { framework:'nextjs', isBackend:false },
        'package.json':   pkg.nextjs(),
      });
      try {
        const r = await detect(dir);
        // Config layer returns directly, curated doesn't run
        expect(r.detectionMethod).toBe('config');
      } finally { await cleanup(); }
    });
  });

  // ── Layer 2: curated detection ────────────────────────────────────────────
  describe('Layer 2 — curated detection for known frameworks', () => {

    test('detects Next.js → isBackend=true (EC2), detectionMethod=curated', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.nextjs() });
      try {
        const r = await detect(dir);
        expect(r.framework).toBe('nextjs');
        expect(r.isBackend).toBe(true);
        expect(r.detectionMethod).toBe('curated');
      } finally { await cleanup(); }
    });

    test('detects Vite → isBackend=false (S3), detectionMethod=curated', async () => {
      const { dir, cleanup } = await makeTempRepo({ 'package.json': pkg.vite() });
      try {
        const r = await detect(dir);
        expect(r.framework).toBe('vite');
        expect(r.isBackend).toBe(false);
        expect(r.detectionMethod).toBe('curated');
      } finally { await cleanup(); }
    });

    test('detects Go with nested main package', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'go.mod':       'module github.com/ARtorias742/Redis\n\ngo 1.22\n',
        'cmd/main.go':  'package main\nfunc main() {}',
        'internal/server/server.go': 'package server\n',
      });
      try {
        const r = await detect(dir);
        expect(r.framework).toBe('go');
        expect(r.isBackend).toBe(true);
        expect(r.goMainPkg).toBe('cmd');
        expect(r.buildCommand).toContain('./cmd');
        expect(r.buildCommand).not.toContain('./...');
      } finally { await cleanup(); }
    });

    test('projectRoot is set to detected subdirectory', async () => {
      const { dir, cleanup } = await makeTempRepo({
        'README.md':          '# Mono',
        'api/go.mod':         'module example.com/api\n\ngo 1.22\n',
        'api/main.go':        'package main\nfunc main() {}',
      });
      try {
        const r = await detect(dir);
        expect(r.projectRoot).toMatch(/api$/);
      } finally { await cleanup(); }
    });
  });

  // ── Layer 3: LLM fallback ─────────────────────────────────────────────────
  describe('Layer 3 — LLM fallback for unknown projects', () => {

    test('returns static default when no API key and project is unknown', async () => {
      delete process.env.OPENROUTER_API_KEY;
      const { dir, cleanup } = await makeTempRepo({ 'README.md': 'Unknown project' });
      try {
        const r = await detect(dir);
        // Falls through to static default
        expect(r.framework).toBe('static');
      } finally { await cleanup(); }
    });
  });

  // ── Priority: isBackend true always wins ──────────────────────────────────
  describe('isBackend=true from detector is never overridden', () => {
    const BACKEND_CASES = [
      { name:'Go',      files:{ 'go.mod':'module x\n\ngo 1.22\n', 'cmd/main.go':'package main\nfunc main(){}' } },
      { name:'Rust',    files:{ 'Cargo.toml':'[package]\nname="app"\nversion="0.1.0"\n', 'src/main.rs':'fn main(){}' } },
      { name:'FastAPI', files:{ 'requirements.txt':'fastapi\nuvicorn\n', 'main.py':'from fastapi import FastAPI\napp=FastAPI()' } },
      { name:'Flask',   files:{ 'requirements.txt':'Flask\ngunicorn\n', 'app.py':'from flask import Flask\napp=Flask(__name__)' } },
      { name:'Express', files:{ 'package.json': JSON.stringify({ dependencies:{ express:'^4.0.0' }, main:'index.js', scripts:{ start:'node index.js' } }) } },
      { name:'Next.js', files:{ 'package.json': JSON.stringify({ dependencies:{ next:'^14.0.0' }, scripts:{ build:'next build' } }) } },
      { name:'Nuxt',    files:{ 'package.json': JSON.stringify({ dependencies:{ nuxt:'^3.0.0' }, scripts:{ build:'nuxt build' } }) } },
    ];

    test.each(BACKEND_CASES)('$name is always EC2 (isBackend=true)', async ({ files }) => {
      const { dir, cleanup } = await makeTempRepo(files);
      try {
        const r = await detect(dir);
        expect(r.isBackend).toBe(true);
      } finally { await cleanup(); }
    });
  });

  describe('isBackend=false for purely static frameworks', () => {
    const STATIC_CASES = [
      { name:'Vite',             files:{ 'package.json': JSON.stringify(pkg.vite()) } },
      { name:'CRA',              files:{ 'package.json': JSON.stringify(pkg.cra()) } },
      { name:'Gatsby',           files:{ 'package.json': JSON.stringify(pkg.gatsby()) } },
      { name:'Astro',            files:{ 'package.json': JSON.stringify(pkg.astro()) } },
      { name:'SvelteKit-static', files:{ 'package.json': JSON.stringify(pkg.sveltestatic()) } },
      { name:'Vue 3 + Vite',     files:{ 'package.json': JSON.stringify(pkg.vue3vite()) } },
      { name:'Vue CLI',          files:{ 'package.json': JSON.stringify(pkg.vuecli()) } },
      { name:'Static HTML',      files:{ 'index.html': '<html></html>' } },
    ];

    test.each(STATIC_CASES)('$name → S3 (isBackend=false)', async ({ files }) => {
      const { dir, cleanup } = await makeTempRepo(files);
      try {
        const r = await detect(dir);
        expect(r.isBackend).toBe(false);
      } finally { await cleanup(); }
    });
  });
});
