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
  collectCoverageFrom: [
    'src/services/configLoader.js',
    'src/services/detector/**/*.js',
    'src/services/dockerfileGenerator.js',
    'src/services/frameworkDetector.js',
    'src/controllers/**/*.js',
    // Excluded (require live infra: Docker socket, AWS, Redis):
    // 'src/services/dockerService.js',
    // 'src/services/ec2Service.js',
    // 'src/services/s3Service.js',
    // 'src/workers/deploymentWorker.js',
  ],

  coverageThreshold: {
    global: {
      lines:     80,
      functions: 80,
      branches:  50,   // LLM/HTTP/ZIP/OpenRouter branches require live services — tested in E2E
      statements:80,
    },
    // Per-file minimums for critical detection logic
    './src/services/detector/curated.js':          { lines: 90, functions: 70 },
    './src/services/detector/index.js':            { lines: 100 },
    './src/services/dockerfileGenerator.js':       { lines: 50 },  // LLM path needs live API
    './src/services/frameworkDetector.js':         { lines: 60 },  // LLM path needs live API
    './src/controllers/projectController.js':      { lines: 90 },
  },

  coverageReporters: ['text', 'lcov', 'json', 'html'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: ['/node_modules/'],
};
