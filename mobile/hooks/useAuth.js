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
  FacebookAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  unlink,
  updateProfile,
} from 'firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AccessToken, LoginManager } from 'react-native-fbsdk-next';
import { auth } from '../firebase';
import api from '../api/client';
import { labelForProviderId } from '../utils/providerLabels';
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
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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

  // Apple Sign-In is iOS-only and feature-detected — simply doesn't render on
  // Android/unsupported iOS versions rather than branching on Platform.OS.
  useEffect(() => {
    (async () => {
      try {
        setAppleAvailable(await AppleAuthentication.isAvailableAsync());
      } catch {
        setAppleAvailable(false);
      }
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
      const credential = await getGoogleCredential();
      if (!credential) return; // user backed out of the picker
      await signInWithCredential(auth, credential);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // nothing to surface
      } else {
        await handleSignInError(err, setError, friendlyGoogleError);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const signInWithFacebook = useCallback(async () => {
    setError(null);
    setFacebookLoading(true);
    try {
      const credential = await getFacebookCredential();
      if (!credential) return; // user cancelled the native Facebook dialog
      await signInWithCredential(auth, credential);
    } catch (err) {
      await handleSignInError(err, setError, friendlyFacebookError);
    } finally {
      setFacebookLoading(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setError(null);
    setAppleLoading(true);
    try {
      const credential = await getAppleCredential();
      if (!credential) return; // user cancelled the native Apple sheet
      await signInWithCredential(auth, credential);
    } catch (err) {
      await handleSignInError(err, setError, friendlyAppleError);
    } finally {
      setAppleLoading(false);
    }
  }, []);

  /**
   * Links a new provider credential onto the CURRENTLY signed-in user, under
   * the same Firebase UID — this is the whole "only 1 account" mechanism.
   * providerType is 'google' | 'facebook' | 'apple'.
   */
  const linkProvider = useCallback(async (providerType) => {
    setError(null);
    setLinking(true);
    try {
      const credential = await acquireCredential(providerType);
      if (!credential) return;
      await linkWithCredential(auth.currentUser, credential);
      setUser({ ...auth.currentUser });
    } catch (err) {
      if (err.code === 'auth/provider-already-linked') {
        // already linked to this account — treat as a no-op
      } else if (err.code === 'auth/credential-already-in-use') {
        setError('That account is already linked to a different Habituate account.');
      } else {
        await handleSignInError(err, setError, friendlyErrorFor(providerType));
      }
    } finally {
      setLinking(false);
    }
  }, []);

  /** providerId is the Firebase providerData id: 'password' | 'google.com' | 'facebook.com' | 'apple.com'. */
  const unlinkProvider = useCallback(async (providerId) => {
    setError(null);
    const providerCount = (auth.currentUser?.providerData || []).length;
    if (providerCount <= 1) {
      setError('Link another sign-in method before removing this one.');
      return;
    }
    setLinking(true);
    try {
      await unlink(auth.currentUser, providerId);
      setUser({ ...auth.currentUser });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlink that sign-in method — try again.');
    } finally {
      setLinking(false);
    }
  }, []);

  /** Deletes the backend's copy of everything this user owns, then the Firebase user itself. */
  const deleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    try {
      await api.deleteAccount();
    } finally {
      setDeletingAccount(false);
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
      signInWithFacebook,
      facebookLoading,
      signInWithApple,
      appleLoading,
      appleAvailable,
      linkProvider,
      unlinkProvider,
      linking,
      deleteAccount,
      deletingAccount,
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

/** Resolves a Firebase-ready credential for sign-in or linking, or null if the user backed out. */
async function acquireCredential(providerType) {
  switch (providerType) {
    case 'google':
      return getGoogleCredential();
    case 'facebook':
      return getFacebookCredential();
    case 'apple':
      return getAppleCredential();
    default:
      throw new Error(`Unknown provider: ${providerType}`);
  }
}

async function getGoogleCredential() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Without this, Play Services can silently resolve signIn() to a cached
  // on-device session with no account picker shown at all and no fresh OAuth
  // exchange — confirmed: that path returns a null idToken.
  await GoogleSignin.signOut().catch(() => {});
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return null;
  return GoogleAuthProvider.credential(response.data.idToken);
}

// Native Facebook SDK (react-native-fbsdk-next), not a browser-based OAuth
// flow — Facebook's "Valid OAuth Redirect URIs" field only accepts https://
// URLs (confirmed: it's specifically for their web login flow), which rules
// out a plain custom-scheme AuthSession redirect without extra hosted-page
// infrastructure. The native SDK handles its own app-switch/webview redirect
// internally via the fb<APP_ID> scheme, which Facebook permits without that
// https restriction.
async function getFacebookCredential() {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) return null;
  const data = await AccessToken.getCurrentAccessToken();
  if (!data) return null;
  return FacebookAuthProvider.credential(data.accessToken);
}

async function getAppleCredential() {
  try {
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const provider = new OAuthProvider('apple.com');
    return provider.credential({ idToken: appleCredential.identityToken });
  } catch (err) {
    if (err.code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}

/**
 * The fragile "fresh sign-in on a different provider, same email" collision.
 * We deliberately don't attempt automatic credential merging here (recovering
 * the original pending credential reliably across RN/Firebase-JS-SDK
 * versions is exactly the kind of fragile corner that made Google Sign-In
 * painful to debug) — instead this surfaces which provider the account
 * already uses, and the user links the new one manually from Account
 * Settings once signed in with the existing provider.
 */
async function collisionMessage(err) {
  const email = err?.customData?.email;
  if (!email) return null;
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (!methods || methods.length === 0) return null;
    const existing = methods.map(labelForProviderId).join(' or ');
    return (
      `An account with this email already exists, signed in with ${existing}. ` +
      `Please sign in with ${existing} first, then link this method from Account Settings → Login & Security.`
    );
  } catch {
    return null;
  }
}

async function handleSignInError(err, setError, friendlyMapper) {
  if (err?.code === 'auth/account-exists-with-different-credential') {
    const message = await collisionMessage(err);
    setError(
      message ||
        'An account with this email already exists using a different sign-in method. ' +
          'Sign in with that method first, then link this one from Account Settings → Login & Security.'
    );
    return;
  }
  setError(friendlyMapper(err));
}

function friendlyErrorFor(providerType) {
  switch (providerType) {
    case 'google':
      return friendlyGoogleError;
    case 'facebook':
      return friendlyFacebookError;
    case 'apple':
      return friendlyAppleError;
    default:
      return (err) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
  }
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

/** Same reasoning as friendlyGoogleError — kept as its own mapper rather than a shared one, for the same debuggability reason. */
function friendlyFacebookError(err) {
  switch (err.code) {
    case 'auth/too-many-requests':
      return 'Too many attempts — take a short break and try again.';
    case 'auth/network-request-failed':
      return 'Network issue — check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
  }
  const detail = err.message || err.code || String(err);
  return `Facebook sign-in failed [${err.code || 'no-code'}]: ${detail}`;
}

/** Same reasoning as friendlyGoogleError — kept as its own mapper rather than a shared one, for the same debuggability reason. */
function friendlyAppleError(err) {
  switch (err.code) {
    case 'auth/too-many-requests':
      return 'Too many attempts — take a short break and try again.';
    case 'auth/network-request-failed':
      return 'Network issue — check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
  }
  const detail = err.message || err.code || String(err);
  return `Apple sign-in failed [${err.code || 'no-code'}]: ${detail}`;
}
