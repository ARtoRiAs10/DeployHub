'use strict';
const fs   = require('fs-extra');
const path = require('path');

function lines(arr) { return arr.join('\n'); }

const TEMPLATES = {
  vite: o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'','FROM nginx:alpine AS runner','COPY --from=builder /app/dist /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  cra:  o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'','FROM nginx:alpine AS runner','COPY --from=builder /app/build /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  gatsby: o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'','FROM nginx:alpine AS runner','COPY --from=builder /app/public /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  astro:  o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'','FROM nginx:alpine AS runner','COPY --from=builder /app/dist /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  'sveltekit-static': o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'','FROM nginx:alpine AS runner','COPY --from=builder /app/build /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  static: () => lines(['FROM nginx:alpine','COPY . /usr/share/nginx/html','EXPOSE 80','CMD ["nginx","-g","daemon off;"]']),
  nextjs: o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .','RUN if grep -q standalone next.config.js 2>/dev/null; then echo ok; elif grep -q module.exports next.config.js 2>/dev/null; then sed -i "s/module\\.exports\\s*=\\s*{/module.exports = { output: \'standalone\',/" next.config.js; else printf "module.exports={output:\'standalone\'};\\n" > next.config.js; fi',`RUN ${o.buildCommand||'npm run build'}`,``,`FROM node:${o.nodeVersion}-alpine AS runner`,'WORKDIR /app','ENV NODE_ENV=production','COPY --from=builder /app/public ./public','COPY --from=builder /app/.next/standalone ./','COPY --from=builder /app/.next/static ./.next/static','EXPOSE 3000','CMD ["node","server.js"]']),
  nuxt: o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,'',`FROM node:${o.nodeVersion}-alpine AS runner`,'WORKDIR /app','COPY --from=builder /app/.output ./','EXPOSE 3000','CMD ["node","server/index.mjs"]']),
  sveltekit: o => lines([`FROM node:${o.nodeVersion}-alpine AS builder`,'WORKDIR /app','COPY package*.json ./','RUN npm ci','COPY . .',`RUN ${o.buildCommand||'npm run build'}`,``,`FROM node:${o.nodeVersion}-alpine AS runner`,'WORKDIR /app','COPY --from=builder /app/build ./build','COPY --from=builder /app/package.json ./','RUN npm ci --omit=dev','EXPOSE 3000','CMD ["node","build/index.js"]']),
  'node-backend': o => lines([`FROM node:${o.nodeVersion}-alpine`,'WORKDIR /app','COPY package*.json ./','RUN npm ci --omit=dev','COPY . .',...(o.buildCommand?[`RUN ${o.buildCommand}`]:[]),'EXPOSE 3000',`CMD ["node","${o.entryPoint||'index.js'}"]`]),
  node: o => lines([`FROM node:${o.nodeVersion}-alpine`,'WORKDIR /app','COPY package*.json ./','RUN npm ci --omit=dev','COPY . .',...(o.buildCommand?[`RUN ${o.buildCommand}`]:[]),'EXPOSE 3000',`CMD ["node","${o.entryPoint||'index.js'}"]`]),
  fastapi: o => lines(['FROM python:3.11-slim','WORKDIR /app','COPY . .','RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi','RUN pip install --no-cache-dir uvicorn','EXPOSE 8000',`CMD ${JSON.stringify((o.startCommand||'uvicorn main:app --host 0.0.0.0 --port 8000').split(' '))}`]),
  flask:   o => lines(['FROM python:3.11-slim','WORKDIR /app','COPY . .','RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi','RUN pip install --no-cache-dir gunicorn flask','EXPOSE 8000',`CMD ${JSON.stringify((o.startCommand||'gunicorn app:app --bind 0.0.0.0:8000 --workers 2').split(' '))}`]),
  django:  o => lines(['FROM python:3.11-slim','WORKDIR /app','COPY . .','RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi','RUN pip install --no-cache-dir gunicorn django',...(o.buildCommand?[`RUN ${o.buildCommand}`]:[]),'EXPOSE 8000',`CMD ${JSON.stringify((o.startCommand||'gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2').split(' '))}`]),
  python:  o => lines(['FROM python:3.11-slim','WORKDIR /app','COPY . .','RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi','EXPOSE 8000',`CMD ["python","${o.entryPoint||'app.py'}"]`]),

  // Go template: uses o.goMainPkg (set by curated.js after scanning for `package main`)
  // to build exactly the right package. Falls back to "." if not set.
  //
  // Why not ./... ?  → fails with "cannot write multiple packages to non-directory main"
  //                    when the module has multiple packages (library + main).
  // Why not .?       → fails with "no Go files in /app" when main lives in ./cmd.
  // Why ./cmd?       → correct: targets only the one main package found by the scanner.
  // BUG FIX: use o.buildCommand directly — it is always set correctly upstream by
  // both curated.js and frameworkDetector.js via findGoMainPackage().
  // Do NOT re-derive buildTarget from goMainPkg here — that creates a second source
  // of truth and the two can drift. The single source is buildCommand.
  go: o => {
    const buildCmd = o.buildCommand || 'CGO_ENABLED=0 GOOS=linux go build -o main .';
    return lines([
      'FROM golang:1.22-alpine AS builder',
      'WORKDIR /app',
      'COPY . .',
      'RUN go mod tidy && go mod download',
      `RUN ${buildCmd}`,
      '',
      'FROM alpine:latest',
      'RUN apk --no-cache add ca-certificates',
      'WORKDIR /app',
      'COPY --from=builder /app/main .',
      'EXPOSE 8080',
      'CMD ["./main"]',
    ]);
  },

  rust: o => { const bin=o.entryPoint||'app'; return lines(['FROM rust:1.75-slim AS builder','WORKDIR /app','COPY . .','RUN cargo build --release','','FROM debian:bookworm-slim','RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*','WORKDIR /app',`COPY --from=builder /app/target/release/${bin} ./app`,'EXPOSE 8080','CMD ["./app"]']); },
  php: () => lines(['FROM php:8.2-apache','WORKDIR /var/www/html','COPY . .','RUN if [ -f composer.json ]; then curl -sS https://getcomposer.org/installer | php && php composer.phar install --no-dev --optimize-autoloader; fi','EXPOSE 80']),
};

const LLM_SYSTEM = `You are a Docker expert. Generate a production-ready Dockerfile for the repository described.
Rules: multi-stage builds, alpine images, EXPOSE correct port, CMD starts the app.
Output ONLY the raw Dockerfile — no markdown, no explanation, no code fences. First line must be FROM.`;

async function generateWithLlm(repoDir, opts) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.warn('[dockerfileGenerator] no OPENROUTER_API_KEY, using generic fallback'); return genericFallback(opts); }
  try {
    const files   = await fs.readdir(repoDir).catch(() => []);
    const PRIORITY = ['package.json','requirements.txt','go.mod','Cargo.toml','main.py','app.py','index.js','server.js'];
    const snapshot = { fileTree: files.slice(0,100), files:{} };
    let total = 0;
    for (const file of [...PRIORITY.filter(f=>files.includes(f)), ...files.filter(f=>!PRIORITY.includes(f)&&/\.(json|toml|txt|js|py)$/.test(f))]) {
      if (total >= 8000) break;
      try { let c = await fs.readFile(path.join(repoDir,file),'utf8'); if(c.length>3000) c=c.slice(0,3000)+'[truncated]'; snapshot.files[file]=c; total+=c.length; } catch{}
    }
    const model    = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json','HTTP-Referer':'https://deployhub.app','X-Title':'DeployHub'},
      body: JSON.stringify({ model, temperature:0, max_tokens:1024, messages:[
        {role:'system',content:LLM_SYSTEM},
        {role:'user',content:`Framework: ${opts.framework}\nBuild: ${opts.buildCommand||'none'}\nOutput: ${opts.outputDir||'.'}\nEntry: ${opts.entryPoint||'unknown'}\nStart: ${opts.startCommand||'unknown'}\n\nFile tree:\n${JSON.stringify(snapshot.fileTree,null,2)}\n\nKey files:\n${JSON.stringify(snapshot.files,null,2)}`},
      ]}),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
    const data = await response.json();
    const raw  = (data?.choices?.[0]?.message?.content||'').trim();
    const dockerfile = raw.replace(/^```(?:dockerfile)?\s*/i,'').replace(/```\s*$/,'').trim();
    if (!dockerfile.toUpperCase().startsWith('FROM')) throw new Error('LLM did not produce a valid Dockerfile');
    return dockerfile;
  } catch (err) {
    console.warn('[dockerfileGenerator] LLM failed:', err.message, '— using generic fallback');
    return genericFallback(opts);
  }
}

function genericFallback(opts) {
  const f = (opts.framework||'').toLowerCase();
  if (f.includes('python')||f.includes('flask')||f.includes('django')||f.includes('fastapi'))
    return lines(['FROM python:3.11-slim','WORKDIR /app','COPY . .','RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi',`EXPOSE ${opts.port||8000}`,`CMD ["python","${opts.entryPoint||'app.py'}"]`]);
  if (f==='go')   return TEMPLATES.go(opts);
  if (f==='rust') return TEMPLATES.rust(opts);
  if (f==='php')  return TEMPLATES.php(opts);
  return lines([`FROM node:${opts.nodeVersion||'20'}-alpine`,'WORKDIR /app','COPY package*.json ./','RUN npm ci --omit=dev','COPY . .',...(opts.buildCommand?[`RUN ${opts.buildCommand}`]:[]),`EXPOSE ${opts.port||3000}`,`CMD ["node","${opts.entryPoint||'index.js'}"]`]);
}

async function generateDockerfile(repoDir, opts) {
  const dockerfilePath = path.join(repoDir, 'Dockerfile');
  if (await fs.pathExists(dockerfilePath)) return { generated:false, path:dockerfilePath };
  const template = TEMPLATES[opts.framework];
  const content  = template ? template(opts) : await generateWithLlm(repoDir, opts);
  await fs.writeFile(dockerfilePath, content + '\n');
  return { generated:true, path:dockerfilePath, framework:opts.framework };
}

module.exports = { generateDockerfile, TEMPLATES };
