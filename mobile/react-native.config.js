// react-native-shared-group-preferences is only ever required on iOS
// (see utils/widgetSync.js's Platform.OS === 'ios' guard) — it exists solely
// to write the App Group UserDefaults the iOS widget extension reads. Its
// own android/build.gradle still calls the long-dead jcenter() repository
// (shut down 2022), which fails outright under this project's Gradle
// version regardless of whether the JS ever touches it. Autolinking has no
// way to know the package is unused on Android, so it must be told
// explicitly here, or every Android build — not just iOS ones — fails.
//
// Known risk, accepted deliberately (2026-11-02): `npx expo-doctor` flags
// this package as unmaintained and untested against React Native's New
// Architecture (which this app requires). It works today — confirmed on a
// real EAS dev-client build — and a replacement means writing a small custom
// Expo Module in Swift to read/write the App Group directly, which isn't
// worth doing preemptively against everything else outstanding. Deliberately
// NOT added to package.json's expo.doctor.reactNativeDirectoryCheck.exclude
// — the warning should keep surfacing on every expo-doctor run as a live
// nudge to revisit this, not get silenced and forgotten. Revisit if a real
// RN/New Architecture upgrade actually breaks it, or if iOS widget
// check-ins start failing with no other explanation.
module.exports = {
  dependencies: {
    'react-native-shared-group-preferences': {
      platforms: {
        android: null,
      },
    },
  },
};
