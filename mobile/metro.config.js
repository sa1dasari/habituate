const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure the "react-native" package.json exports condition is resolved
// before "browser" / "default". This makes @firebase/auth load its RN
// build (which includes getReactNativePersistence) instead of the browser
// build that relies on IndexedDB.
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'import',
];

module.exports = config;
