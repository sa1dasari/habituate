// react-native-shared-group-preferences is only ever required on iOS
// (see utils/widgetSync.js's Platform.OS === 'ios' guard) — it exists solely
// to write the App Group UserDefaults the iOS widget extension reads. Its
// own android/build.gradle still calls the long-dead jcenter() repository
// (shut down 2022), which fails outright under this project's Gradle
// version regardless of whether the JS ever touches it. Autolinking has no
// way to know the package is unused on Android, so it must be told
// explicitly here, or every Android build — not just iOS ones — fails.
module.exports = {
  dependencies: {
    'react-native-shared-group-preferences': {
      platforms: {
        android: null,
      },
    },
  },
};
