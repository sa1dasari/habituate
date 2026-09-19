import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Firebase project config — these values are safe to commit (they're public
 * client-side identifiers, not secrets). Security is enforced by Firebase
 * Security Rules and the server-side token verification in the Spring Boot API.
 *
 * Replace the placeholder values below with your actual Firebase project config.
 * Get them from: Firebase Console → Project Settings → Your apps → SDK setup.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'REPLACE_ME',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'REPLACE_ME',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'REPLACE_ME',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'REPLACE_ME',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'REPLACE_ME',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'REPLACE_ME',
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// initializeAuth must be called exactly once per app instance.
// On hot-reload getAuth works because auth is already registered.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (_e) {
  auth = getAuth(app);
}

export { auth };
export default app;
