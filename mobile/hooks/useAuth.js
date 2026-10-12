import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { auth } from '../firebase';
import {
  clearBiometricCredentials,
  getBiometricCredentials,
  getBiometricLabel,
  getSavedBiometricEmail,
  isBiometricHardwareAvailable,
  saveBiometricCredentials,
} from '../utils/biometricAuth';

// webClientId must be the WEB-type OAuth client — Google Play Services uses
// it to mint a Firebase-usable idToken, while the app itself is attested via
// the ANDROID-type client already registered in Google Cloud Console
// (package name + signing cert), matched automatically, never referenced
// here directly.
//
// Deliberately NOT passing a `scopes` option: an earlier attempt added
// `scopes: ['openid', 'profile', 'email']` on a theory (this library uses
// Credential Manager, which needs 'openid' explicit) that turned out to be
// wrong — confirmed via source inspection that this version uses the
// legacy GoogleSignInOptions/GoogleSignInClient API, where requestIdToken()
// handles the ID token exchange independently of requestScopes() entirely.
// Per user report, sign-in worked cleanly through multiple login/logout
// cycles on the very first install (webClientId alone, no scopes option)
// and only started failing with auth/argument-error after that scopes
// change shipped via OTA — a raw 'openid' string is not a valid scope URI
// for this API and was likely corrupting the whole scope request silently.
function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || '',
  });
}
configureGoogleSignIn();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [error, setError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');

  // Re-checked on mount only — availability can't meaningfully change within
  // one app session (hardware/enrollment don't flip, and saved credentials
  // only change via this same hook's own save/clear calls).
  useEffect(() => {
    (async () => {
      const hardwareOk = await isBiometricHardwareAvailable();
      if (!hardwareOk) return;
      const savedEmail = await getSavedBiometricEmail();
      if (!savedEmail) return;
      setBiometricAvailable(true);
      setBiometricLabel(await getBiometricLabel());
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
    // Fire-and-forget: lets the login screen offer fingerprint sign-in next
    // time, without blocking this sign-in on it or surfacing its own errors.
    isBiometricHardwareAvailable().then((available) => {
      if (!available) return;
      saveBiometricCredentials(email, password)
        .then(getBiometricLabel)
        .then((label) => {
          setBiometricAvailable(true);
          setBiometricLabel(label);
        })
        .catch(() => {});
    });
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(credential.user, { displayName });
      }
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
  }, []);

  // Shared by updateDisplayName/updatePhotoURL — updateProfile mutates
  // auth.currentUser in place but doesn't trigger onAuthStateChanged, so the
  // context's own `user` wouldn't re-render without this; a fresh object
  // reference is what React actually diffs on.
  const applyProfileUpdate = useCallback(async (fields) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, fields);
    setUser({ ...auth.currentUser });
  }, []);

  const updateDisplayName = useCallback(
    (displayName) => applyProfileUpdate({ displayName }),
    [applyProfileUpdate]
  );

  const updatePhotoURL = useCallback(
    (photoURL) => applyProfileUpdate({ photoURL }),
    [applyProfileUpdate]
  );

  /** Only meaningful for an email/password account — the caller checks providerData first. */
  const sendPasswordReset = useCallback(async () => {
    if (!auth.currentUser?.email) return;
    await sendPasswordResetEmail(auth, auth.currentUser.email);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Without this, Play Services can silently resolve signIn() to a
      // cached on-device session with no account picker shown at all and no
      // fresh OAuth exchange — confirmed: that path returns a null idToken.
      // Signing out first guarantees a real picker and a real exchange every
      // time, rather than reactively retrying only after detecting a miss.
      await GoogleSignin.signOut().catch(() => {});
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        // User backed out of the picker — not an app-level error.
        return;
      }
      const { idToken } = response.data;
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // Same as the picker-cancel case above — nothing to surface.
      } else {
        setError(friendlyGoogleError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const signInWithBiometrics = useCallback(async () => {
    setError(null);
    setBiometricLoading(true);
    try {
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        // Cancelled/failed OS prompt — not an app-level error.
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      } catch (err) {
        // The saved password no longer works (changed elsewhere) — drop the
        // stale credential rather than keep offering a button that can't work.
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          await clearBiometricCredentials();
          setBiometricAvailable(false);
        }
        setError(friendlyError(err));
      }
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return createElement(AuthContext.Provider, {
    value: {
      user,
      error,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      googleLoading,
      signInWithBiometrics,
      biometricLoading,
      biometricAvailable,
      biometricLabel,
      clearError,
      updateDisplayName,
      updatePhotoURL,
      sendPasswordReset,
    },
    children,
  });
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Maps Firebase error codes to user-friendly, non-punitive messages. */
function friendlyError(err) {
  switch (err.code) {
    case 'auth/invalid-email':
      return 'That email address doesn\'t look right — double-check it.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password didn\'t match — give it another try.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password needs to be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts — take a short break and try again.';
    case 'auth/network-request-failed':
      return 'Network issue — check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Google Sign-In errors come from two different sources with two different
 * code formats: the native GoogleSignin SDK (statusCodes.* strings, or raw
 * native codes like '10'/DEVELOPER_ERROR for a misconfigured OAuth client)
 * before a credential ever reaches Firebase, and Firebase's own auth/* codes
 * after signInWithCredential. friendlyError() only knows the second kind, so
 * anything else fell through to a useless generic message — this surfaces
 * the real code/message instead, which matters while this flow is still
 * being debugged during beta.
 */
function friendlyGoogleError(err) {
  // Only auth/* codes that are actually reachable from a Google credential
  // sign-in get a hand-written message — unlike friendlyError()'s full list
  // (invalid-email, weak-password, etc.), which is for email/password and
  // mostly can't occur here. Everything else — including any other auth/*
  // code — shows the raw code/message rather than silently collapsing into
  // friendlyError()'s generic default, which is what was hiding the real
  // cause behind an identical "Something went wrong" every time.
  switch (err.code) {
    case 'auth/too-many-requests':
      return 'Too many attempts — take a short break and try again.';
    case 'auth/network-request-failed':
      return 'Network issue — check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
  }
  if (isErrorWithCode(err)) {
    switch (err.code) {
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services isn\'t available or needs an update on this device.';
      case statusCodes.IN_PROGRESS:
        return 'A sign-in is already in progress — wait a moment and try again.';
      case statusCodes.SIGN_IN_REQUIRED:
        return 'Please sign in with Google again.';
    }
  }
  const detail = err.message || err.code || String(err);
  return `Google sign-in failed [${err.code || 'no-code'}]: ${detail}`;
}
