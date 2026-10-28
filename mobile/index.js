import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Home-screen widgets (SKILLS.md Phase 7). Android's widget task handler
// must be registered once at the top level, outside the React tree, per
// `react-native-android-widget`'s own requirement — it's what lets a
// widget tap run `widgets/widgetTaskHandler.js` as a headless JS task even
// when the app isn't open. Guarded by Platform so iOS/web never pull in an
// Android-only native module.
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./widgets/widgetTaskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (e) {
    if (__DEV__) console.warn('[widgets] registerWidgetTaskHandler unavailable:', e?.message);
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
