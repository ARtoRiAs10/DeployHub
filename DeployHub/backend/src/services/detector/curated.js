'use strict';
const fs   = require('fs-extra');
const path = require('path');

async function detectFromCuratedList(repoDir) {
  const rootResult = await detectInDir(repoDir);
  if (rootResult) return { ...rootResult, projectRoot: repoDir };

  let entries = [];
  try { entries = await fs.readdir(repoDir, { withFileTypes: true }); } catch { return null; }

  const subdirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => path.join(repoDir, e.name));

  for (const subdir of subdirs) {
    const sub = await detectInDir(subdir);
    if (sub) return { ...sub, projectRoot: subdir };
  }
  return null;
}

async function detectInDir(dir) {
  const files   = await fs.readdir(dir).catch(() => []);
  const fileSet = new Set(files);

  // 1. Dockerfile
  if (fileSet.has('Dockerfile')) {
    return { framework:'docker', buildCommand:null, outputDir:'.', nodeVersion:'20',
             hasDockerfile:true, isBackend:true, entryPoint:null, startCommand:null,
             port:3000, detectionMethod:'curated' };
  }

  // 2. Go — scan for `package main` to get the exact build target
  if (fileSet.has('go.mod')) {
    const goMainPkg   = await findGoMainPackage(dir);
    const buildTarget = goMainPkg ? `./${goMainPkg}` : '.';
    return { framework:'go',
             buildCommand:`CGO_ENABLED=0 GOOS=linux go build -o main ${buildTarget}`,
             goMainPkg, outputDir:'.', nodeVersion:'20',
             hasDockerfile:false, isBackend:true, entryPoint:'main', startCommand:'./main',
             port:8080, detectionMethod:'curated' };
  }

  // 3. Rust
  if (fileSet.has('Cargo.toml')) {
    let bin = 'app';
    try { const c = await fs.readFile(path.join(dir,'Cargo.toml'),'utf8'); const m = c.match(/^\s*name\s*=\s*"([^"]+)"/m); if(m) bin=m[1].trim(); } catch {}
    return { framework:'rust', buildCommand:'cargo build --release', outputDir:'./target/release',
             nodeVersion:'20', hasDockerfile:false, isBackend:true,
             entryPoint:bin, startCommand:`./${bin}`, port:8080, detectionMethod:'curated' };
  }

  // 4. Node.js
  if (fileSet.has('package.json')) {
    let pkg = {};
    try { pkg = await fs.readJson(path.join(dir,'package.json')); } catch {}
    const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };

    // Next.js — FIX: isBackend=true because Next.js SSR requires a Node server (EC2).
    // It is NOT a static site. The Dockerfile produces `node server.js`, not HTML files.
    // Routing it to S3 uploads raw .next internals which are not serveable as a website.
    if (deps['next'])
      return { framework:'nextjs', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'.next', nodeVersion:'20', hasDockerfile:false,
               isBackend:true,   // ← FIXED (was false)
               entryPoint:null, startCommand:'node server.js', port:3000, detectionMethod:'curated' };

    // Nuxt — FIX: same reason as Next.js. Nuxt SSR needs `node server/index.mjs`.
    if (deps['nuxt']||deps['@nuxt/core']||deps['@nuxt/kit'])
      return { framework:'nuxt', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'.output', nodeVersion:'20', hasDockerfile:false,
               isBackend:true,   // ← FIXED (was false)
               entryPoint:null, startCommand:'node server/index.mjs', port:3000, detectionMethod:'curated' };

    // SvelteKit SSR
    if (deps['@sveltejs/kit']) {
      const isStatic = !!deps['@sveltejs/adapter-static'];
      return { framework: isStatic ? 'sveltekit-static' : 'sveltekit',
               buildCommand: pkg.scripts?.build||'npm run build',
               outputDir: isStatic ? 'build' : '.svelte-kit', nodeVersion:'20',
               hasDockerfile:false, isBackend:!isStatic,
               entryPoint:null, startCommand:isStatic?null:'node build/index.js',
               port:3000, detectionMethod:'curated' };
    }

    // Vite (covers Vue 3 + Vite, React + Vite, Solid + Vite)
    if (deps['vite']||deps['@vitejs/plugin-react']||deps['@vitejs/plugin-vue']||deps['@vitejs/plugin-solid'])
      return { framework:'vite', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'dist', nodeVersion:'20', hasDockerfile:false,
               isBackend:false, entryPoint:null, startCommand:null, port:3000, detectionMethod:'curated' };

    // Astro, Gatsby, CRA
    if (deps['astro'])
      return { framework:'astro', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'dist', nodeVersion:'20', hasDockerfile:false,
               isBackend:false, entryPoint:null, startCommand:null, port:3000, detectionMethod:'curated' };
    if (deps['gatsby'])
      return { framework:'gatsby', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'public', nodeVersion:'20', hasDockerfile:false,
               isBackend:false, entryPoint:null, startCommand:null, port:3000, detectionMethod:'curated' };
    if (deps['react-scripts'])
      return { framework:'cra', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'build', nodeVersion:'20', hasDockerfile:false,
               isBackend:false, entryPoint:null, startCommand:null, port:3000, detectionMethod:'curated' };

    // FIX: Vue CLI (@vue/cli-service) — uses webpack, outputs to dist/ like CRA
    // Not detected before → fell through to LLM/static, causing build failures
    if (deps['@vue/cli-service'])
      return { framework:'vite', buildCommand:pkg.scripts?.build||'npm run build',
               outputDir:'dist', nodeVersion:'20', hasDockerfile:false,
               isBackend:false, entryPoint:null, startCommand:null, port:3000, detectionMethod:'curated' };

    // Express / Fastify
    if (deps['express']||deps['fastify']) {
      const entry = pkg.main || resolveStart(pkg) || 'index.js';
      return { framework:'node-backend', buildCommand:null, outputDir:'.', nodeVersion:'20',
               hasDockerfile:false, isBackend:true,
               entryPoint:entry, startCommand:pkg.scripts?.start||`node ${entry}`,
               port:3000, detectionMethod:'curated' };
    }
  }

  // 5. Python
  if (fileSet.has('requirements.txt')||fileSet.has('pyproject.toml')) {
    const reqs      = await fs.readFile(path.join(dir,'requirements.txt'),'utf8').catch(()=>'');
    const pyproject = await fs.readFile(path.join(dir,'pyproject.toml'),'utf8').catch(()=>'');
    const combined  = (reqs+pyproject).toLowerCase();
    if (combined.includes('fastapi')||combined.includes('uvicorn')) {
      const entry = fileSet.has('main.py')?'main.py':'app.py';
      return { framework:'fastapi', buildCommand:null, outputDir:'.', nodeVersion:'20',
               hasDockerfile:false, isBackend:true, entryPoint:entry,
               startCommand:`uvicorn ${entry.replace('.py','')}:app --host 0.0.0.0 --port 8000`,
               port:8000, detectionMethod:'curated' };
    }
    if (combined.includes('flask')) {
      const entry = fileSet.has('app.py')?'app.py':fileSet.has('run.py')?'run.py':'app.py';
      return { framework:'flask', buildCommand:null, outputDir:'.', nodeVersion:'20',
               hasDockerfile:false, isBackend:true, entryPoint:entry,
               startCommand:`gunicorn ${entry.replace('.py','')}:app --bind 0.0.0.0:8000 --workers 2`,
               port:8000, detectionMethod:'curated' };
    }
    if (combined.includes('django')) {
      return { framework:'django', buildCommand:'python manage.py collectstatic --noinput',
               outputDir:'.', nodeVersion:'20', hasDockerfile:false, isBackend:true,
               entryPoint:'manage.py',
               startCommand:'gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2',
               port:8000, detectionMethod:'curated' };
    }
  }

  // 6. Static HTML
  if (fileSet.has('index.html')&&!fileSet.has('package.json'))
    return { framework:'static', buildCommand:null, outputDir:'.', nodeVersion:'20',
             hasDockerfile:false, isBackend:false, entryPoint:null, startCommand:null,
             port:80, detectionMethod:'curated' };

  return null;
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
      await findFilesWithPackageMain(full, results);
      continue;
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

function resolveStart(pkg) {
  if (pkg.scripts?.start) { const m = pkg.scripts.start.match(/node\s+(.+?)(\s|$)/); if(m) return m[1].trim(); }
  return null;
}

module.exports = { detectFromCuratedList };
