'use strict';
const { loadProjectConfig }     = require('../configLoader');
const { detectFromCuratedList } = require('./curated');
const { detectFramework }       = require('../frameworkDetector');

const DEFAULTS = Object.freeze({
  framework:'static', buildCommand:null, outputDir:'.', nodeVersion:'20',
  hasDockerfile:false, isBackend:false, entryPoint:null, startCommand:null, detectionMethod:'static',
});

async function detect(repoDir) {
  const userConfig = await loadProjectConfig(repoDir);
  if (userConfig.framework) {
    console.log('[detector] Layer 1 (config):', userConfig.framework);
    return { ...DEFAULTS, ...userConfig, projectRoot: repoDir, detectionMethod: 'config' };
  }
  const curated = await detectFromCuratedList(repoDir);
  if (curated) {
    const { projectRoot, ...rest } = curated;
    console.log('[detector] Layer 2 (curated):', rest.framework, 'root:', projectRoot);
    return { ...DEFAULTS, ...rest, ...userConfig, projectRoot };
  }
  console.log('[detector] Layer 3 (full/AI)...');
  const detected = await detectFramework(repoDir);
  return { ...DEFAULTS, ...detected, ...userConfig, projectRoot: repoDir };
}
module.exports = { detect };
