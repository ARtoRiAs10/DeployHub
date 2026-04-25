'use strict';
const fs   = require('fs-extra');
const path = require('path');

const STATIC_FRAMEWORKS = new Set(['vite','cra','gatsby','astro','sveltekit-static','static']);
const SERVER_FRAMEWORKS = new Set(['nextjs','nuxt','sveltekit','node-backend','node',
  'python','flask','fastapi','django','go','rust','php','docker']);

const DEFAULTS = Object.freeze({
  framework:'static', buildCommand:null, outputDir:'.', nodeVersion:'20',
  hasDockerfile:false, isBackend:false, entryPoint:null, startCommand:null,
  port:3000, goMainPkg:null, detectionMethod:'static',
});

async function detectFramework(repoDir) {
  const files   = await fs.readdir(repoDir).catch(() => []);
  const fileSet = new Set(files);

  if (fileSet.has('Dockerfile')) return { ...DEFAULTS, framework:'docker', hasDockerfile:true, isBackend:true, port:3000 };

  if (fileSet.has('go.mod')) {
    const goMainPkg   = await findGoMainPackage(repoDir);
    const buildTarget = goMainPkg ? `./${goMainPkg}` : '.';
    return { ...DEFAULTS, framework:'go', isBackend:true, port:8080, goMainPkg,
             buildCommand:`CGO_ENABLED=0 GOOS=linux go build -o main ${buildTarget}` };
  }

  if (fileSet.has('Cargo.toml')) {
    let bin = 'app';
    try { const c = await fs.readFile(path.join(repoDir,'Cargo.toml'),'utf8'); const m = c.match(/^\s*name\s*=\s*"([^"]+)"/m); if(m) bin=m[1].trim(); } catch {}
    return { ...DEFAULTS, framework:'rust', isBackend:true, port:8080, entryPoint:bin, startCommand:`./${bin}` };
  }

  const hasPython = fileSet.has('requirements.txt')||fileSet.has('pyproject.toml')||fileSet.has('Pipfile')||fileSet.has('setup.py');
  if (hasPython) return detectPythonFramework(repoDir, files);

  if (fileSet.has('composer.json')) return { ...DEFAULTS, framework:'php', isBackend:true, port:80, startCommand:'php -S 0.0.0.0:8080 -t public' };

  if (fileSet.has('package.json')) {
    const nodeResult = await detectNodeFramework(repoDir);
    if (nodeResult.framework !== 'static' || fileSet.has('index.html')) return nodeResult;
    return tryLlmFallback(repoDir, files, nodeResult);
  }

  if (fileSet.has('index.html')) return { ...DEFAULTS, framework:'static', isBackend:false, port:80 };

  return tryLlmFallback(repoDir, files, { ...DEFAULTS });
}

async function detectPythonFramework(repoDir, files) {
  const fileSet = new Set(files);
  const reqs      = await fs.readFile(path.join(repoDir,'requirements.txt'),'utf8').catch(()=>'');
  const pyproject = await fs.readFile(path.join(repoDir,'pyproject.toml'),'utf8').catch(()=>'');
  const combined  = (reqs+pyproject).toLowerCase();
  if (combined.includes('fastapi')||combined.includes('uvicorn')) {
    const entry = fileSet.has('main.py')?'main.py':(fileSet.has('app.py')?'app.py':'main.py');
    return { ...DEFAULTS, framework:'fastapi', isBackend:true, port:8000, entryPoint:entry,
             startCommand:`uvicorn ${entry.replace('.py','')}:app --host 0.0.0.0 --port 8000` };
  }
  if (combined.includes('django'))
    return { ...DEFAULTS, framework:'django', buildCommand:'python manage.py collectstatic --noinput',
             isBackend:true, port:8000, entryPoint:'manage.py',
             startCommand:'gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2' };
  if (combined.includes('flask')) {
    const entry = fileSet.has('app.py')?'app.py':(fileSet.has('run.py')?'run.py':'app.py');
    return { ...DEFAULTS, framework:'flask', isBackend:true, port:8000, entryPoint:entry,
             startCommand:`gunicorn ${entry.replace('.py','')}:app --bind 0.0.0.0:8000 --workers 2` };
  }
  const entry = fileSet.has('main.py')?'main.py':(fileSet.has('app.py')?'app.py':'main.py');
  return { ...DEFAULTS, framework:'python', isBackend:true, port:8000, entryPoint:entry, startCommand:`python ${entry}` };
}

async function detectNodeFramework(repoDir) {
  let pkg = {};
  try { pkg = await fs.readJson(path.join(repoDir,'package.json')); } catch { return { ...DEFAULTS }; }
  const deps     = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
  const depNames = Object.keys(deps);

  // FIX: Next.js and Nuxt are SSR frameworks — they require a Node server to run.
  // They must deploy to EC2 (isBackend:true), NOT S3.
  // Previously isBackend:false caused: S3 upload of .next/.output internals → broken site.
  if (deps['next'])
    return { ...DEFAULTS, framework:'nextjs', buildCommand:pkg.scripts?.build||'npm run build',
             outputDir:'.next', isBackend:true, port:3000,  // ← FIXED
             startCommand:'node server.js' };

  if (deps['nuxt']||deps['@nuxt/core']||deps['@nuxt/kit'])
    return { ...DEFAULTS, framework:'nuxt', buildCommand:pkg.scripts?.build||'npm run build',
             outputDir:'.output', isBackend:true, port:3000,  // ← FIXED
             startCommand:'node server/index.mjs' };

  if (deps['@sveltejs/kit']) {
    const isStatic = !!deps['@sveltejs/adapter-static'];
    return { ...DEFAULTS, framework:isStatic?'sveltekit-static':'sveltekit',
             buildCommand:pkg.scripts?.build||'npm run build',
             outputDir:isStatic?'build':'.svelte-kit', isBackend:!isStatic, port:3000 };
  }

  if (deps['astro'])         return { ...DEFAULTS, framework:'astro',   buildCommand:pkg.scripts?.build||'npm run build', outputDir:'dist',    isBackend:false, port:3000 };
  if (deps['gatsby'])        return { ...DEFAULTS, framework:'gatsby',  buildCommand:pkg.scripts?.build||'npm run build', outputDir:'public',  isBackend:false, port:3000 };
  if (deps['react-scripts']) return { ...DEFAULTS, framework:'cra',     buildCommand:pkg.scripts?.build||'npm run build', outputDir:'build',   isBackend:false, port:3000 };

  // Vite — covers Vue 3+Vite, React+Vite, Solid+Vite
  if (deps['vite']||deps['@vitejs/plugin-react']||deps['@vitejs/plugin-vue']||deps['@vitejs/plugin-solid'])
    return { ...DEFAULTS, framework:'vite', buildCommand:pkg.scripts?.build||'npm run build', outputDir:'dist', isBackend:false, port:3000 };

  // FIX: Vue CLI (@vue/cli-service) — webpack-based, outputs to dist/
  // Was not detected before → fell to LLM/static
  if (deps['@vue/cli-service'])
    return { ...DEFAULTS, framework:'vite', buildCommand:pkg.scripts?.build||'npm run build', outputDir:'dist', isBackend:false, port:3000 };

  const BACKEND_DEPS = ['express','fastify','koa','hapi','@hapi/hapi','@nestjs/core','nestjs','restify','polka','h3'];
  if (BACKEND_DEPS.some(d => depNames.includes(d))) {
    const entry = resolveNodeEntry(pkg);
    return { ...DEFAULTS, framework:'node-backend',
             buildCommand:(pkg.scripts?.build&&pkg.scripts.build!=='echo "no build"')?'npm run build':null,
             outputDir:'.', isBackend:true, port:3000, entryPoint:entry,
             startCommand:pkg.scripts?.start||`node ${entry}` };
  }

  const hasStart = !!pkg.scripts?.start;
  const entry    = resolveNodeEntry(pkg);
  return { ...DEFAULTS, framework:hasStart?'node-backend':'node',
           buildCommand:pkg.scripts?.build?'npm run build':null,
           outputDir:'dist', isBackend:hasStart, port:3000,
           entryPoint:entry, startCommand:pkg.scripts?.start||`node ${entry}` };
}

function resolveNodeEntry(pkg) {
  if (pkg.main) return pkg.main;
  if (pkg.scripts?.start) { const m = pkg.scripts.start.match(/node\s+(.+?)(\s|$)/); if(m) return m[1].trim(); }
  return 'index.js';
}

async function buildRepoSnapshot(repoDir, files) {
  const MAX_FILE = 4000, MAX_TOTAL = 12000;
  const PRIORITY = ['package.json','requirements.txt','pyproject.toml','Pipfile','go.mod','Cargo.toml',
    'composer.json','Makefile','Procfile','setup.py','main.py','app.py','index.js','server.js'];
  const ordered = [...PRIORITY.filter(f=>files.includes(f)),
    ...files.filter(f=>!PRIORITY.includes(f)&&/\.(json|toml|txt|js|ts|py|go|rs)$/.test(f))];
  const snapshot = { fileTree:files.slice(0,200), files:{} };
  let total = 0;
  for (const file of ordered) {
    if (total >= MAX_TOTAL) break;
    try {
      const stat = await fs.stat(path.join(repoDir,file));
      if (!stat.isFile()) continue;
      let content = await fs.readFile(path.join(repoDir,file),'utf8');
      if (content.length > MAX_FILE) content = content.slice(0,MAX_FILE)+'\n[truncated]';
      snapshot.files[file] = content; total += content.length;
    } catch {}
  }
  return snapshot;
}

const LLM_SYSTEM = `You are a build-system expert. Analyse a repository snapshot and return ONLY a JSON object — no markdown, no explanation.
Required fields: {"framework":string,"buildCommand":string|null,"outputDir":string,"nodeVersion":string,"isBackend":boolean,"entryPoint":string|null,"startCommand":string|null,"port":number|null,"goMainPkg":string|null}
Field notes:
- goMainPkg: for Go projects, the relative path of the directory containing "package main" (e.g. "cmd", "cmd/server"). null if main.go is at root.
- port: the port the app listens on (8080 for Go/Rust, 8000 for Python, 3000 for Node/Next/Nuxt, 80 for PHP/static).
- isBackend: true for Go, Rust, Python, Node API, Next.js SSR, Nuxt SSR, SvelteKit SSR. false ONLY for purely static output (Vite, CRA, Gatsby, Astro, static HTML).
Valid frameworks: nextjs|nuxt|sveltekit|sveltekit-static|vite|cra|gatsby|astro|static|node-backend|node|fastapi|flask|django|python|go|rust|php|docker
Return ONLY the JSON object.`;

async function tryLlmFallback(repoDir, files, staticResult) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return staticResult;
  try {
    const snapshot = await buildRepoSnapshot(repoDir, files);
    const userMsg  = `Repository file tree:\n${JSON.stringify(snapshot.fileTree,null,2)}\n\nKey file contents:\n${JSON.stringify(snapshot.files,null,2)}`;
    const model    = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json','HTTP-Referer':'https://deployhub.app','X-Title':'DeployHub'},
      body: JSON.stringify({ model, temperature:0, max_tokens:512, messages:[{role:'system',content:LLM_SYSTEM},{role:'user',content:userMsg}] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
    const data    = await response.json();
    const rawText = data?.choices?.[0]?.message?.content||'';
    const jsonText = rawText.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
    const parsed   = JSON.parse(jsonText);
    return mergeLlm(parsed);
  } catch (err) {
    console.warn('[frameworkDetector] LLM fallback failed:', err.message);
    return staticResult;
  }
}

const VALID_FRAMEWORKS = new Set(['nextjs','nuxt','sveltekit','sveltekit-static','vite','cra','gatsby','astro',
  'static','node-backend','node','fastapi','flask','django','python','go','rust','php','docker']);

function mergeLlm(llm) {
  const framework = VALID_FRAMEWORKS.has(llm.framework) ? llm.framework : 'static';
  const isBackend  = typeof llm.isBackend==='boolean' ? llm.isBackend : SERVER_FRAMEWORKS.has(framework);

  const rawPort = Number(llm.port);
  const port    = (Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536) ? rawPort : null;

  const goMainPkg = (typeof llm.goMainPkg==='string' && llm.goMainPkg.trim() && !llm.goMainPkg.startsWith('/'))
    ? llm.goMainPkg.trim() : null;

  // Enforce correct Go build command regardless of what LLM returned
  let buildCommand = typeof llm.buildCommand==='string' ? llm.buildCommand : null;
  if (framework === 'go') {
    buildCommand = goMainPkg
      ? `CGO_ENABLED=0 GOOS=linux go build -o main ./${goMainPkg}`
      : 'CGO_ENABLED=0 GOOS=linux go build -o main .';
  }

  return {
    framework, buildCommand,
    outputDir:    typeof llm.outputDir==='string'    ? llm.outputDir    : '.',
    nodeVersion:  /^\d+$/.test(String(llm.nodeVersion||'')) ? String(llm.nodeVersion) : '20',
    hasDockerfile: false, isBackend,
    entryPoint:   typeof llm.entryPoint==='string'   ? llm.entryPoint   : null,
    startCommand: typeof llm.startCommand==='string' ? llm.startCommand : null,
    port, goMainPkg, detectionMethod:'llm',
  };
}

// ── Go main-package scanner ────────────────────────────────────────────────────
async function findGoMainPackage(moduleRoot) {
  const mainFiles = await findFilesWithPackageMain(moduleRoot);
  if (mainFiles.length === 0) return null;
  const PREFERRED = ['cmd','cmd/server','cmd/app','cmd/main','server','app'];
  for (const preferred of PREFERRED) {
    const found = mainFiles.find(f => {
      const rel = path.relative(moduleRoot, path.dirname(f));
      return rel === preferred || rel.startsWith(preferred + path.sep);
    });
    if (found) {
      const rel = path.relative(moduleRoot, path.dirname(found));
      return rel === '' ? null : rel;
    }
  }
  const rel = path.relative(moduleRoot, path.dirname(mainFiles[0]));
  return rel === '' ? null : rel;
}

async function findFilesWithPackageMain(dir, results = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['vendor','testdata','node_modules'].includes(entry.name)||entry.name.startsWith('.')) continue;
      await findFilesWithPackageMain(full, results); continue;
    }
    if (!entry.name.endsWith('.go')||entry.name.endsWith('_test.go')) continue;
    try {
      const fd = await require('fs').promises.open(full,'r'); const buf = Buffer.alloc(256);
      await fd.read(buf,0,256,0); await fd.close();
      if (/^\s*package\s+main\b/m.test(buf.toString('utf8'))) results.push(full);
    } catch {}
  }
  return results;
}

module.exports = { detectFramework, STATIC_FRAMEWORKS, SERVER_FRAMEWORKS };
