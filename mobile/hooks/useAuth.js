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
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../firebase';
import {
  clearBiometricCredentials,
  getBiometricCredentials,
  getBiometricLabel,
  getSavedBiometricEmail,
  isBiometricHardwareAvailable,
  saveBiometricCredentials,
} from '../utils/biometricAuth';

WebBrowser.maybeCompleteAuthSession();

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

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID || '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .catch(err => setError(friendlyError(err)))
        .finally(() => setGoogleLoading(false));
    }
  }, [googleResponse]);

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
      const result = await googlePromptAsync();
      // A dismiss/cancel resolves rather than throwing, and there's no
      // 'success' response coming to clear the flag via the effect above —
      // without this, backing out of the picker left both sign-in buttons
      // disabled until the app reloaded.
      if (result?.type !== 'success') {
        setGoogleLoading(false);
      }
    } catch (err) {
      setError(friendlyError(err));
      setGoogleLoading(false);
    }
  }, [googlePromptAsync]);

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
