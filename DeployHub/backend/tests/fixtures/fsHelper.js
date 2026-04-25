'use strict';
const fs   = require('fs-extra');
const path = require('path');
const os   = require('os');

/**
 * Creates a real temp directory with given files, returns { dir, cleanup }.
 * Content can be a string or object (auto-JSON-stringified).
 */
async function makeTempRepo(files = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deployhub-test-'));
  for (const [filePath, content] of Object.entries(files)) {
    const full = path.join(dir, filePath);
    await fs.ensureDir(path.dirname(full));
    const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    await fs.writeFile(full, text, 'utf8');
  }
  return { dir, cleanup: () => fs.remove(dir).catch(() => {}) };
}

/** Factory functions for common package.json shapes */
const pkg = {
  nextjs:       (x={}) => ({ name:'app', dependencies:{ next:'^14.0.0', react:'^18.0.0' }, scripts:{ build:'next build', start:'next start' }, ...x }),
  nuxt:         (x={}) => ({ name:'app', dependencies:{ nuxt:'^3.0.0' }, scripts:{ build:'nuxt build' }, ...x }),
  vite:         (x={}) => ({ name:'app', devDependencies:{ vite:'^5.0.0', '@vitejs/plugin-react':'^4.0.0' }, scripts:{ build:'vite build' }, ...x }),
  vue3vite:     (x={}) => ({ name:'app', dependencies:{ vue:'^3.0.0' }, devDependencies:{ vite:'^5.0.0', '@vitejs/plugin-vue':'^5.0.0' }, scripts:{ build:'vite build' }, ...x }),
  vuecli:       (x={}) => ({ name:'app', dependencies:{ vue:'^2.0.0' }, devDependencies:{ '@vue/cli-service':'^5.0.0' }, scripts:{ build:'vue-cli-service build' }, ...x }),
  cra:          (x={}) => ({ name:'app', dependencies:{ react:'^18.0.0', 'react-scripts':'^5.0.0' }, scripts:{ build:'react-scripts build' }, ...x }),
  gatsby:       (x={}) => ({ name:'app', dependencies:{ gatsby:'^5.0.0' }, scripts:{ build:'gatsby build' }, ...x }),
  astro:        (x={}) => ({ name:'app', devDependencies:{ astro:'^4.0.0' }, scripts:{ build:'astro build' }, ...x }),
  sveltekit:    (x={}) => ({ name:'app', devDependencies:{ '@sveltejs/kit':'^2.0.0' }, scripts:{ build:'vite build' }, ...x }),
  sveltestatic: (x={}) => ({ name:'app', devDependencies:{ '@sveltejs/kit':'^2.0.0', '@sveltejs/adapter-static':'^3.0.0' }, scripts:{ build:'vite build' }, ...x }),
  express:      (x={}) => ({ name:'api', main:'index.js', dependencies:{ express:'^4.0.0' }, scripts:{ start:'node index.js' }, ...x }),
  fastify:      (x={}) => ({ name:'api', main:'server.js', dependencies:{ fastify:'^4.0.0' }, scripts:{ start:'node server.js' }, ...x }),
};

module.exports = { makeTempRepo, pkg };
