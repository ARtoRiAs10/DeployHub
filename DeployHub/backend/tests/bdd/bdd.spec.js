'use strict';
/**
 * BDD spec runner — wires jest-cucumber feature files to their step definitions.
 * Jest picks this file up via the testMatch glob in package.json.
 */

// Import step definition files — each calls defineFeature() which registers
// the tests with Jest automatically via jest-cucumber.
require('./step_definitions/framework_detection.steps');
require('./step_definitions/dockerfile_generation.steps');
