// Scoped to the skyline engine's pure functions only (SKYLINE.md Phase 1) —
// no RN rendering, no jest-expo preset, so this stays small and fast.
const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/utils/skylineScene.test.js',
    '<rootDir>/utils/sky.test.js',
    '<rootDir>/utils/skylineAdapter.test.js',
    '<rootDir>/utils/moonPhase.test.js',
    '<rootDir>/utils/lots.test.js',
    '<rootDir>/utils/consistency.test.js',
  ],
  transform: {
    // <rootDir> isn't interpolated inside transform option objects (only in
    // a few known top-level config fields) — use an absolute path instead.
    '^.+\\.js$': ['babel-jest', { configFile: path.join(__dirname, 'babel.config.test.js') }],
  },
};
