/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],
  verbose: true,
  testTimeout: 15000,

  // Collect coverage only from files that CAN be unit-tested.
  // Infrastructure files (dockerService, ec2Service, s3Service, deploymentWorker)
  // require live Docker/AWS connections and are excluded from thresholds —
  // they are tested via integration/E2E in staging environments.
  //
  // nginxController.js is also excluded — it requires a live EC2/nginx connection
  // and is covered by E2E tests in staging.
  collectCoverageFrom: [
    'src/services/configLoader.js',
    'src/services/detector/**/*.js',
    'src/services/dockerfileGenerator.js',
    'src/services/frameworkDetector.js',
    'src/controllers/deploymentController.js',
    'src/controllers/projectController.js',
    // Excluded (require live infra: Docker socket, AWS, Redis, EC2/nginx):
    // 'src/controllers/nginxController.js',
    // 'src/services/dockerService.js',
    // 'src/services/ec2Service.js',
    // 'src/services/s3Service.js',
    // 'src/workers/deploymentWorker.js',
  ],

  coverageThreshold: {
    global: {
      // Thresholds reflect current coverage of unit-testable code.
      // nginxController is excluded (requires live EC2).
      // Raise these as more tests are added.
      lines:      55,   // target: 80 — blocked by projectController untested routes
      functions:  40,   // target: 80 — blocked by projectController untested handlers
      branches:   47,   // target: 50 — LLM/HTTP branches need live API in E2E
      statements: 56,   // target: 80 — raise alongside lines
    },

    // ── Per-file minimums for critical detection logic ─────────────────────
    // These files are well-tested and should never regress below these values.
    './src/services/detector/curated.js': {
      lines:     90,
      functions: 70,
    },
    './src/services/detector/index.js': {
      lines: 100,
    },

    // LLM path requires live OpenRouter API — only non-LLM paths are covered here.
    './src/services/dockerfileGenerator.js': {
      lines: 50,
    },
    './src/services/frameworkDetector.js': {
      lines: 60,
    },

    // projectController has many routes that require more integration tests.
    // Raise to 90 once nginx/port-allocation routes are fully covered.
    './src/controllers/projectController.js': {
      lines: 51,
    },

    // deploymentController is well covered by the existing integration tests.
    './src/controllers/deploymentController.js': {
      lines: 80,
    },
  },

  coverageReporters: ['text', 'lcov', 'json', 'html'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: ['/node_modules/'],
};