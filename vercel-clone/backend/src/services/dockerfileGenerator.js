const fs = require('fs-extra');
const path = require('path');

const TEMPLATES = {
  nextjs: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}

FROM node:${opts.nodeVersion}-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
`.trim(),

  nuxt: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}

FROM node:${opts.nodeVersion}-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.output ./
EXPOSE 3000
CMD ["node", "server/index.mjs"]
`.trim(),

  vite: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}
# Output in /app/dist
`.trim(),

  cra: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}
# Output in /app/build
`.trim(),

  gatsby: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}
# Output in /app/public
`.trim(),

  sveltekit: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}
# Output in /app/build
`.trim(),

  astro: (opts) => `
FROM node:${opts.nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ${opts.buildCommand || 'npm run build'}
# Output in /app/dist
`.trim(),

  node: (opts) => `
FROM node:${opts.nodeVersion}-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
${opts.buildCommand ? `RUN ${opts.buildCommand}` : ''}
EXPOSE 3000
CMD ["node", "index.js"]
`.trim(),

  python: (opts) => `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
${opts.buildCommand ? `RUN ${opts.buildCommand}` : ''}
EXPOSE 8000
CMD ["python", "app.py"]
`.trim(),

  go: (opts) => `
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
`.trim(),

  rust: (opts) => `
FROM rust:1.75-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/* .
EXPOSE 8080
CMD ["./app"]
`.trim(),

  php: (opts) => `
FROM php:8.2-apache
WORKDIR /var/www/html
COPY . .
RUN if [ -f composer.json ]; then curl -sS https://getcomposer.org/installer | php && php composer.phar install; fi
EXPOSE 80
`.trim(),

  static: (opts) => `
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`.trim(),
};

/**
 * Generate a Dockerfile for the given framework and write it to the repo dir.
 * If the repo already has a Dockerfile, skip.
 */
async function generateDockerfile(repoDir, opts) {
  const dockerfilePath = path.join(repoDir, 'Dockerfile');

  if (await fs.pathExists(dockerfilePath)) {
    return { generated: false, path: dockerfilePath };
  }

  const template = TEMPLATES[opts.framework] || TEMPLATES.static;
  const content = template(opts);

  await fs.writeFile(dockerfilePath, content + '\n');
  return { generated: true, path: dockerfilePath, framework: opts.framework };
}

module.exports = { generateDockerfile, TEMPLATES };
