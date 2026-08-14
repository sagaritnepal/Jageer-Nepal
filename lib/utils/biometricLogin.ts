// lib/utils/biometricLogin.ts
import * as SecureStore from 'expo-secure-store';

const key = 'biometric_login_credentials';

interface StoredCredentials {
  email: string;
  password: string;
}

/** Whether this device currently has credentials saved for fingerprint
 * sign-in (set after a successful password login + opt-in, cleared on
 * sign-out - see useAuth.ts). */
export async function hasBiometricCredentials(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(key);
  return value !== null;
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify({ email, password } satisfies StoredCredentials));
}

export async function getBiometricCredentials(): Promise<StoredCredentials | null> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  return JSON.parse(value) as StoredCredentials;
}

export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
