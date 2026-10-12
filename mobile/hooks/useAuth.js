import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert } from 'react-native';
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
// Confirmed via a plain browser OAuth request against this exact
// webClientId (bypassing the app and Play Services entirely) that Google's
// server mints a fully valid idToken for this account without issue — so
// the Cloud Console config (client, scopes, consent screen) is NOT the
// problem. Every in-app attempt has still returned a missing idToken
// regardless. configure() is a fire-and-forget native bridge call with no
// promise to await; called once here at module-load time, there's a real
// possibility the native side hasn't actually applied it yet by the time a
// user taps "Sign in" moments after the app opens — a GoogleSignInOptions
// built before webClientId lands natively silently never calls
// requestIdToken() at all. configureGoogleSignIn() is re-called defensively
// right before every sign-in attempt (see signInWithGoogle) as well as here.
function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || '',
    scopes: ['openid', 'profile', 'email'],
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
      configureGoogleSignIn();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      let response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        // User backed out of the picker — not an app-level error.
        return;
      }
      // A cached/already-remembered account sometimes short-circuits the
      // native picker and comes back without an idToken (confirmed:
      // auth/argument-error from GoogleAuthProvider.credential(null)).
      // getTokens() alone wasn't enough to recover it either — the signed-in
      // state itself is stale, not just this one response — so as a last
      // resort, force a full native sign-out and a completely fresh sign-in
      // (user sees the account picker again), which gets a real OAuth
      // exchange instead of whatever Play Services had cached.
      let idToken = response.data.idToken;
      const stage1 = idToken ? 'present' : 'MISSING';
      let stage2 = 'skipped';
      if (!idToken) {
        try {
          idToken = (await GoogleSignin.getTokens()).idToken;
          stage2 = idToken ? 'present' : 'MISSING';
        } catch (e) {
          idToken = null;
          stage2 = `threw: ${e?.message || e}`;
        }
      }
      let stage3 = 'skipped';
      if (!idToken) {
        await GoogleSignin.signOut();
        response = await GoogleSignin.signIn();
        if (response.type !== 'success') {
          return;
        }
        idToken = response.data.idToken;
        stage3 = idToken ? 'present' : 'MISSING';
      }
      // TEMPORARY, beta-only diagnostic: every stage has returned MISSING so
      // far despite a genuinely fresh, explicit account selection — this
      // shows exactly which one(s) failed this attempt instead of guessing.
      if (!idToken) {
        Alert.alert(
          'Google sign-in idToken trace',
          `initial signIn(): ${stage1}\ngetTokens(): ${stage2}\nforced re-auth: ${stage3}`
        );
      }
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
