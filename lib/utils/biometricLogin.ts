// lib/utils/biometricLogin.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const key = 'biometric_login_credentials';

interface StoredCredentials {
  email: string;
  password: string;
}

// Fingerprint sign-in is a mobile-only concept here, but these functions run
// unconditionally from login.tsx on every platform - expo-secure-store's web
// implementation doesn't support getItemAsync in this SDK version (throws
// "getValueWithKeyAsync is not a function"), which crashed the web login
// screen outright. Web always reports "nothing saved" instead of touching
// SecureStore at all.
const isWeb = Platform.OS === 'web';

/** Whether this device currently has credentials saved for fingerprint
 * sign-in (set after a successful password login + opt-in, cleared on
 * sign-out - see useAuth.ts). */
export async function hasBiometricCredentials(): Promise<boolean> {
  if (isWeb) return false;
  const value = await SecureStore.getItemAsync(key);
  return value !== null;
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  if (isWeb) return;
  await SecureStore.setItemAsync(key, JSON.stringify({ email, password } satisfies StoredCredentials));
}

export async function getBiometricCredentials(): Promise<StoredCredentials | null> {
  if (isWeb) return null;
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  return JSON.parse(value) as StoredCredentials;
}

export async function clearBiometricCredentials(): Promise<void> {
  if (isWeb) return;
  await SecureStore.deleteItemAsync(key);
}
