// lib/utils/biometric.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const storageKey = (userId: string) => `biometric_lock_enabled:${userId}`;

export async function isBiometricHardwareReady(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function isBiometricLockEnabled(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(storageKey(userId));
  return value === 'true';
}

export async function setBiometricLockEnabled(userId: string, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), enabled ? 'true' : 'false');
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Jageer Nepal',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}
