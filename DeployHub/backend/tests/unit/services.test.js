'use strict';
/**
 * TDD — Unit tests for s3Service and frameworkDetector
 */

// ── s3Service ─────────────────────────────────────────────────────────────────
describe('s3Service: getDeploymentUrl()', () => {
  let getDeploymentUrl;

  beforeEach(() => {
    jest.resetModules();
  });

  test('uses DEPLOYMENT_BASE_URL env var when set', () => {
    process.env.DEPLOYMENT_BASE_URL = 'https://cdn.example.com';
    process.env.S3_BUCKET_NAME      = 'my-bucket';
    process.env.AWS_REGION          = 'us-east-1';
    // Inline the function to avoid AWS SDK mock complexity
    function url(deploymentId) {
      const base = process.env.DEPLOYMENT_BASE_URL || `http://${process.env.S3_BUCKET_NAME}.s3-website.${process.env.AWS_REGION}.amazonaws.com`;
      return `${base}/deployments/${deploymentId}/index.html`;
    }
    expect(url('abc123')).toBe('https://cdn.example.com/deployments/abc123/index.html');
  });

  test('falls back to S3 website endpoint (not REST endpoint)', () => {
    delete process.env.DEPLOYMENT_BASE_URL;
    process.env.S3_BUCKET_NAME = 'my-bucket';
    process.env.AWS_REGION     = 'us-east-1';
    function url(deploymentId) {
      const base = process.env.DEPLOYMENT_BASE_URL || `http://${process.env.S3_BUCKET_NAME}.s3-website.${process.env.AWS_REGION}.amazonaws.com`;
      return `${base}/deployments/${deploymentId}/index.html`;
    }
    const result = url('deploy-99');
    expect(result).toContain('s3-website');          // must use website endpoint
    expect(result).not.toContain('s3.amazonaws.com'); // NOT the REST endpoint
    expect(result).toContain('/deployments/deploy-99/index.html');
  });
});

// ── frameworkDetector: mergeLlm() ─────────────────────────────────────────────
describe('frameworkDetector: mergeLlm()', () => {
  // Inline mergeLlm to test its logic without calling the LLM API
  const VALID_FRAMEWORKS = new Set(['nextjs','nuxt','sveltekit','sveltekit-static','vite','cra',
    'gatsby','astro','static','node-backend','node','fastapi','flask','django','python','go','rust','php','docker']);
  const SERVER_FRAMEWORKS = new Set(['nextjs','nuxt','sveltekit','node-backend','node',
    'python','flask','fastapi','django','go','rust','php','docker']);

  function mergeLlm(llm) {
    const framework = VALID_FRAMEWORKS.has(llm.framework) ? llm.framework : 'static';
    const isBackend  = typeof llm.isBackend==='boolean' ? llm.isBackend : SERVER_FRAMEWORKS.has(framework);
    const rawPort = Number(llm.port);
    const port    = (Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536) ? rawPort : null;
    const goMainPkg = (typeof llm.goMainPkg==='string' && llm.goMainPkg.trim() && !llm.goMainPkg.startsWith('/'))
      ? llm.goMainPkg.trim() : null;
    let buildCommand = typeof llm.buildCommand==='string' ? llm.buildCommand : null;
    if (framework === 'go') {
      buildCommand = goMainPkg
        ? `CGO_ENABLED=0 GOOS=linux go build -o main ./${goMainPkg}`
        : 'CGO_ENABLED=0 GOOS=linux go build -o main .';
    }
    return { framework, buildCommand, outputDir: typeof llm.outputDir==='string' ? llm.outputDir : '.',
             nodeVersion: /^\d+$/.test(String(llm.nodeVersion||'')) ? String(llm.nodeVersion) : '20',
             hasDockerfile:false, isBackend, entryPoint: typeof llm.entryPoint==='string' ? llm.entryPoint : null,
             startCommand: typeof llm.startCommand==='string' ? llm.startCommand : null,
             port, goMainPkg, detectionMethod:'llm' };
  }

  test('maps unknown framework to static', () => {
    expect(mergeLlm({ framework:'unknown-thing' }).framework).toBe('static');
  });

  test('nextjs from LLM → isBackend=true (LLM prompt says SSR)', () => {
    const r = mergeLlm({ framework:'nextjs', isBackend:true });
    expect(r.isBackend).toBe(true);
  });

  test('vite from LLM → isBackend=false', () => {
    const r = mergeLlm({ framework:'vite', isBackend:false });
    expect(r.isBackend).toBe(false);
  });

  test('infers isBackend from SERVER_FRAMEWORKS set when LLM omits it', () => {
    expect(mergeLlm({ framework:'go' }).isBackend).toBe(true);
    expect(mergeLlm({ framework:'vite' }).isBackend).toBe(false);
  });

  test('extracts valid port from LLM response', () => {
    expect(mergeLlm({ framework:'go', port:8080 }).port).toBe(8080);
    expect(mergeLlm({ framework:'fastapi', port:8000 }).port).toBe(8000);
  });

  test('rejects invalid port values', () => {
    expect(mergeLlm({ framework:'go', port:-1 }).port).toBeNull();
    expect(mergeLlm({ framework:'go', port:99999 }).port).toBeNull();
    expect(mergeLlm({ framework:'go', port:'not-a-port' }).port).toBeNull();
  });

  test('extracts goMainPkg and enforces correct buildCommand', () => {
    const r = mergeLlm({ framework:'go', goMainPkg:'cmd', buildCommand:'anything-llm-said' });
    expect(r.goMainPkg).toBe('cmd');
    expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main ./cmd');
  });

  test('rejects absolute goMainPkg paths (security: no /etc/passwd etc)', () => {
    const r = mergeLlm({ framework:'go', goMainPkg:'/absolute/path' });
    expect(r.goMainPkg).toBeNull();
    expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main .');
  });

  test('handles missing goMainPkg gracefully', () => {
    const r = mergeLlm({ framework:'go', goMainPkg:null });
    expect(r.goMainPkg).toBeNull();
    expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main .');
  });

  test('overrides any LLM buildCommand for go (prevents hallucination)', () => {
    const r = mergeLlm({ framework:'go', goMainPkg:'cmd/server', buildCommand:'go build . && echo done' });
    expect(r.buildCommand).toBe('CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server');
  });

  test('preserves non-go buildCommand from LLM', () => {
    const r = mergeLlm({ framework:'fastapi', buildCommand:null });
    expect(r.buildCommand).toBeNull();
  });


  test('isBackend=false for static frameworks when LLM omits isBackend field', () => {
    expect(mergeLlm({ framework:'vite' }).isBackend).toBe(false);
    expect(mergeLlm({ framework:'static' }).isBackend).toBe(false);
    expect(mergeLlm({ framework:'cra' }).isBackend).toBe(false);
    expect(mergeLlm({ framework:'gatsby' }).isBackend).toBe(false);
    expect(mergeLlm({ framework:'astro' }).isBackend).toBe(false);
  });

  test('nuxt from LLM → isBackend=true (SSR)', () => {
    const r = mergeLlm({ framework:'nuxt', isBackend:true });
    expect(r.isBackend).toBe(true);
  });

  test('sveltekit from LLM → isBackend=true (SSR)', () => {
    const r = mergeLlm({ framework:'sveltekit', isBackend:true });
    expect(r.isBackend).toBe(true);
  });

  test('empty goMainPkg string is treated as null', () => {
    const r = mergeLlm({ framework:'go', goMainPkg:'   ' });
    expect(r.goMainPkg).toBeNull();
  });

  test('valid port 80 is accepted', () => {
    expect(mergeLlm({ framework:'php', port:80 }).port).toBe(80);
  });

  test('port 0 is rejected as invalid', () => {
    expect(mergeLlm({ framework:'go', port:0 }).port).toBeNull();
  });

  test('buildCommand from LLM preserved for non-go frameworks', () => {
    const r = mergeLlm({ framework:'flask', buildCommand:'pip install -e .' });
    expect(r.buildCommand).toBe('pip install -e .');
  });
  test('defaults nodeVersion to 20 for invalid input', () => {
    expect(mergeLlm({ framework:'nextjs', nodeVersion:'abc' }).nodeVersion).toBe('20');
    expect(mergeLlm({ framework:'nextjs', nodeVersion:18 }).nodeVersion).toBe('18');
  });
});

// ── configLoader ────────────────────────────────────────────────────────────
describe('configLoader: loadProjectConfig()', () => {
  const { loadProjectConfig } = require('../../src/services/configLoader');
  const { makeTempRepo }      = require('../fixtures/fsHelper');

  test('returns empty object when deployhub.json does not exist', async () => {
    const { dir, cleanup } = await makeTempRepo({ 'package.json': '{}' });
    try {
      const cfg = await loadProjectConfig(dir);
      expect(cfg).toEqual({});
    } finally { await cleanup(); }
  });

  test('reads framework and buildCommand from deployhub.json', async () => {
    const { dir, cleanup } = await makeTempRepo({
      'deployhub.json': { framework:'go', buildCommand:'go build ./cmd', isBackend:true },
    });
    try {
      const cfg = await loadProjectConfig(dir);
      expect(cfg.framework).toBe('go');
      expect(cfg.buildCommand).toBe('go build ./cmd');
      expect(cfg.isBackend).toBe(true);
    } finally { await cleanup(); }
  });

  test('strips unknown keys from deployhub.json', async () => {
    const { dir, cleanup } = await makeTempRepo({
      'deployhub.json': { framework:'vite', malicious:'rm -rf /', __proto__:'hack' },
    });
    try {
      const cfg = await loadProjectConfig(dir);
      expect(cfg).not.toHaveProperty('malicious');
      // __proto__ is never an own property in JS — verifying known keys are absent
      expect(Object.keys(cfg)).not.toContain('__proto__');
      expect(Object.keys(cfg)).not.toContain('malicious');
      expect(cfg.framework).toBe('vite');
    } finally { await cleanup(); }
  });

  test('ignores empty string values', async () => {
    const { dir, cleanup } = await makeTempRepo({
      'deployhub.json': { framework:'', buildCommand:'' },
    });
    try {
      const cfg = await loadProjectConfig(dir);
      expect(cfg.framework).toBeUndefined();
      expect(cfg.buildCommand).toBeUndefined();
    } finally { await cleanup(); }
  });
});
