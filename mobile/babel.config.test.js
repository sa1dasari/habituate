// Jest-only Babel config (see jest.config.js). Deliberately NOT named
// babel.config.js — Metro auto-discovers that filename and would start
// using this instead of its own default Expo transform for the real app
// bundle. Scoped to Jest's two pure-function test files only.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
