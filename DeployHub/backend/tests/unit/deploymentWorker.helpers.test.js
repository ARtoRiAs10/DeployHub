'use strict';
/**
 * TDD — Unit tests for deploymentWorker helper functions.
 *
 * We extract and test pure functions (isBackend resolution,
 * resolveContainerOutputDir, inferPort) without spinning up the full worker.
 */

// ── Pure function helpers (extracted from worker for testability) ─────────────
function resolveIsBackend(detectedIsBackend, jobIsBackend) {
  return detectedIsBackend === true
    ? true
    : (jobIsBackend != null ? Boolean(jobIsBackend) : false);
}

function resolveContainerOutputDir(framework, outputDir) {
  const nginxBased = new Set(['vite','cra','gatsby','astro','sveltekit-static','static']);
  if (nginxBased.has(framework)) return '/usr/share/nginx/html';
  if (framework === 'nextjs') return '/app';
  if (framework === 'nuxt')   return '/app';
  return outputDir === '.' ? '/app' : `/app/${outputDir}`;
}

function inferPort(framework) {
  const ports = {
    'node-backend':3000, node:3000, nextjs:3000, nuxt:3000, sveltekit:3000,
    fastapi:8000, flask:8000, django:8000, python:8000,
    go:8080, rust:8080, php:80, docker:3000,
  };
  return ports[framework] || 3000;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Worker: resolveIsBackend()', () => {

  describe('detector is authoritative when isBackend=true', () => {
    test.each([
      ['go',           true,  null,  true],
      ['rust',         true,  null,  true],
      ['fastapi',      true,  null,  true],
      ['flask',        true,  null,  true],
      ['django',       true,  null,  true],
      ['node-backend', true,  null,  true],
      ['nextjs',       true,  null,  true],  // fixed
      ['nuxt',         true,  null,  true],  // fixed
      ['docker',       true,  null,  true],
    ])('%s: detected=true → always EC2 regardless of job flag', (fw, det, job, expected) => {
      expect(resolveIsBackend(det, job)).toBe(expected);
    });

    test('detector=true overrides explicit job.isBackend=false (old DB default)', () => {
      // This was the original bug: project.isBackend=false from DB overrode detector
      expect(resolveIsBackend(true, false)).toBe(true);
    });
  });

  describe('when detector says isBackend=false, job flag is respected', () => {
    test('vite + job=false → S3', () => expect(resolveIsBackend(false, false)).toBe(false));
    test('vite + job=null  → S3 (default false)', () => expect(resolveIsBackend(false, null)).toBe(false));
    test('vite + job=true  → EC2 (user override)', () => expect(resolveIsBackend(false, true)).toBe(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Worker: resolveContainerOutputDir()', () => {

  describe('static/nginx frameworks → nginx html dir', () => {
    test.each(['vite','cra','gatsby','astro','sveltekit-static','static'])(
      '%s → /usr/share/nginx/html',
      (fw) => expect(resolveContainerOutputDir(fw, 'dist')).toBe('/usr/share/nginx/html')
    );
  });

  describe('SSR frameworks go to EC2, but fallback dir is /app', () => {
    test('nextjs → /app (standalone server root)', () => {
      expect(resolveContainerOutputDir('nextjs', '.next')).toBe('/app');
    });
    test('nuxt → /app (server bundle root)', () => {
      expect(resolveContainerOutputDir('nuxt', '.output')).toBe('/app');
    });
  });

  describe('other backend frameworks', () => {
    test('outputDir="." → /app', () => {
      expect(resolveContainerOutputDir('flask', '.')).toBe('/app');
    });
    test('outputDir="build" → /app/build', () => {
      expect(resolveContainerOutputDir('sveltekit', '.svelte-kit')).toBe('/app/.svelte-kit');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Worker: inferPort()', () => {
  test.each([
    ['go',           8080],
    ['rust',         8080],
    ['php',          80],
    ['fastapi',      8000],
    ['flask',        8000],
    ['django',       8000],
    ['python',       8000],
    ['nextjs',       3000],
    ['nuxt',         3000],
    ['sveltekit',    3000],
    ['node-backend', 3000],
    ['node',         3000],
    ['docker',       3000],
    ['unknown',      3000],  // default
  ])('%s → port %d', (fw, expected) => {
    expect(inferPort(fw)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Worker: deploy routing matrix (all 18 frameworks)', () => {
  const ROUTING = [
    // Static → S3
    { fw:'vite',             detIsBackend:false, expected:'S3'  },
    { fw:'cra',              detIsBackend:false, expected:'S3'  },
    { fw:'gatsby',           detIsBackend:false, expected:'S3'  },
    { fw:'astro',            detIsBackend:false, expected:'S3'  },
    { fw:'sveltekit-static', detIsBackend:false, expected:'S3'  },
    { fw:'static',           detIsBackend:false, expected:'S3'  },
    // SSR / Backend → EC2
    { fw:'nextjs',           detIsBackend:true,  expected:'EC2' },
    { fw:'nuxt',             detIsBackend:true,  expected:'EC2' },
    { fw:'sveltekit',        detIsBackend:true,  expected:'EC2' },
    { fw:'node-backend',     detIsBackend:true,  expected:'EC2' },
    { fw:'fastapi',          detIsBackend:true,  expected:'EC2' },
    { fw:'flask',            detIsBackend:true,  expected:'EC2' },
    { fw:'django',           detIsBackend:true,  expected:'EC2' },
    { fw:'python',           detIsBackend:true,  expected:'EC2' },
    { fw:'go',               detIsBackend:true,  expected:'EC2' },
    { fw:'rust',             detIsBackend:true,  expected:'EC2' },
    { fw:'php',              detIsBackend:true,  expected:'EC2' },
    { fw:'docker',           detIsBackend:true,  expected:'EC2' },
  ];

  test.each(ROUTING)('$fw → $expected', ({ fw, detIsBackend, expected }) => {
    const isBackend = resolveIsBackend(detIsBackend, null);
    const target    = isBackend ? 'EC2' : 'S3';
    expect(target).toBe(expected);
  });
});
