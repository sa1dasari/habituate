/**
 * @bacons/apple-targets config for the Habituate WidgetKit extension
 * (SKILLS.md Phase 7 "Home-screen widget for quick check-in").
 *
 * This is the mechanism that lets a WidgetKit App Extension target exist
 * in a managed-ish Expo project without hand-maintaining an Xcode project
 * in the repo: `@bacons/apple-targets` reads this file (and the Swift
 * sources alongside it) during `expo prebuild` (which EAS Build runs in
 * the cloud, per `eas.json`'s profiles) and generates a real extension
 * target wired into the generated `ios/` Xcode project — no `ios/` folder
 * needs to be checked into this repo for that to work.
 *
 * `entitlements.com.apple.security.application-groups` is what grants both
 * this extension AND the main app access to the same shared container —
 * see `mobile/utils/widgetSync.js`'s `IOS_APP_GROUP` constant, which MUST
 * stay in sync with the id below. The main app's own entitlements also
 * need this same App Group added, which `app.json`'s
 * `ios.entitlements` (see the repo-root edit alongside this file) does.
 *
 * MANUAL STEP A HUMAN MUST DO (cannot be done from this codebase):
 * the App Group "group.com.habituate.mobile.widget" must actually be
 * registered under the Apple Developer account this app's provisioning
 * profile belongs to (Certificates, Identifiers & Profiles → Identifiers →
 * App Groups) before EAS Build's prebuild/signing step can attach it to
 * either target. Without that, the build either fails at signing or the
 * capability silently doesn't attach.
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'HabituateWidget',
  bundleIdentifier: `${config.ios.bundleIdentifier}.widget`,
  deploymentTarget: '16.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.habituate.mobile.widget'],
  },
  // Matches theme.js's accent/safe tokens so SwiftUI's accentColor and the
  // widget's own asset catalog colors line up with the rest of the app —
  // SwiftUI reads named colors like this via Color("AccentColor") etc.
  colors: {
    $accent: '#2563EB',
    $safe: '#047857',
    $background: '#FFFFFF',
    $textPrimary: '#111827',
    $textSecondary: '#6B7280',
  },
});
