const fs = require('fs-extra');
const path = require('path');

/**
 * Detect the framework of a project directory.
 * Returns { framework, buildCommand, outputDir, nodeVersion }
 */
async function detectFramework(repoDir) {
  const result = {
    framework: 'static',
    buildCommand: null,
    outputDir: '.',
    nodeVersion: '20',
  };

  const files = await fs.readdir(repoDir).catch(() => []);

  // Check for Dockerfile first
  if (files.includes('Dockerfile')) {
    return { ...result, framework: 'docker', hasDockerfile: true };
  }

  // Check for Go
  if (files.includes('go.mod')) {
    return { ...result, framework: 'go', hasDockerfile: false };
  }

  // Check for Rust
  if (files.includes('Cargo.toml')) {
    return { ...result, framework: 'rust', hasDockerfile: false };
  }

  // Check for Python
  if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    return { ...result, framework: 'python', buildCommand: 'echo "no build"', outputDir: '.', hasDockerfile: false };
  }

  // Check for PHP
  if (files.includes('composer.json')) {
    return { ...result, framework: 'php', hasDockerfile: false };
  }

  // Node.js family
  if (files.includes('package.json')) {
    try {
      const pkg = await fs.readJson(path.join(repoDir, 'package.json'));
      const deps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (deps['next']) {
        return {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          outputDir: '.next',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['nuxt'] || deps['nuxt3']) {
        return {
          framework: 'nuxt',
          buildCommand: 'npm run build',
          outputDir: '.output/public',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['@sveltejs/kit']) {
        return {
          framework: 'sveltekit',
          buildCommand: 'npm run build',
          outputDir: 'build',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['astro']) {
        return {
          framework: 'astro',
          buildCommand: 'npm run build',
          outputDir: 'dist',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
        return {
          framework: 'vite',
          buildCommand: 'npm run build',
          outputDir: 'dist',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['react-scripts']) {
        return {
          framework: 'cra',
          buildCommand: 'npm run build',
          outputDir: 'build',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }
      if (deps['gatsby']) {
        return {
          framework: 'gatsby',
          buildCommand: 'npm run build',
          outputDir: 'public',
          nodeVersion: '20',
          hasDockerfile: false,
        };
      }

      // Generic Node.js
      return {
        framework: 'node',
        buildCommand: pkg.scripts?.build ? 'npm run build' : null,
        outputDir: 'dist',
        nodeVersion: '20',
        hasDockerfile: false,
      };
    } catch (e) {
      // ignore
    }
  }

  // Plain HTML/CSS/JS static site
  if (files.includes('index.html')) {
    return { framework: 'static', buildCommand: null, outputDir: '.', nodeVersion: '20', hasDockerfile: false };
  }

  return { ...result, hasDockerfile: false };
}

module.exports = { detectFramework };
