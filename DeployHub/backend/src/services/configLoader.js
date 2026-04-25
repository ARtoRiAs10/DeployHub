'use strict';
const fs   = require('fs-extra');
const path = require('path');
const ALLOWED = ['framework','buildCommand','outputDir','nodeVersion','isBackend','entryPoint','startCommand'];
async function loadProjectConfig(repoDir) {
  try {
    const raw = await fs.readJson(path.join(repoDir, 'deployhub.json'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const config = {};
    for (const key of ALLOWED) {
      if (raw[key] !== undefined && raw[key] !== '') config[key] = raw[key];
    }
    if (Object.keys(config).length > 0) console.log('[configLoader]', JSON.stringify(config));
    return config;
  } catch { return {}; }
}
module.exports = { loadProjectConfig };
