import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Two keys, deliberately split: FLAG is plain (just "is anything saved, for
 * which email") so the login screen can decide whether to show the
 * fingerprint button without triggering a biometric prompt on every mount.
 * CREDENTIALS is requireAuthentication-gated — reading it is what actually
 * triggers the OS fingerprint/Face ID prompt, backed by the device's secure
 * hardware (Keychain/Keystore), not application code.
 */
const FLAG_KEY = 'habituate_biometric_flag';
const CREDENTIALS_KEY = 'habituate_biometric_credentials';

export async function isBiometricHardwareAvailable() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

/** "Face ID" on devices with facial recognition, "Fingerprint" otherwise — matches what the OS prompt will actually ask for. */
export async function getBiometricLabel() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : 'Fingerprint';
}

export async function getSavedBiometricEmail() {
  const raw = await SecureStore.getItemAsync(FLAG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).email ?? null;
  } catch {
    return null;
  }
}

export async function saveBiometricCredentials(email, password) {
  await SecureStore.setItemAsync(FLAG_KEY, JSON.stringify({ email }));
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ email, password }),
    {
      requireAuthentication: true,
      authenticationPrompt: 'Confirm it\'s you to enable fingerprint sign-in',
    }
  );
}

/** Triggers the OS biometric prompt. Returns null if the user cancels, authentication fails, or nothing is saved — never throws. */
export async function getBiometricCredentials() {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Sign in to Habituate',
    });
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // A cancelled/failed OS prompt rejects rather than resolving null — treat
    // it the same as "no credentials", not an app-level error.
    return null;
  }
}

export async function clearBiometricCredentials() {
  await SecureStore.deleteItemAsync(FLAG_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}
