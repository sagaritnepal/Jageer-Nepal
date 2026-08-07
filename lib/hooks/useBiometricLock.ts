// lib/hooks/useBiometricLock.ts
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { authenticateWithBiometrics, isBiometricLockEnabled, setBiometricLockEnabled } from '../utils/biometric';

interface BiometricLockState {
  enabled: boolean;
  locked: boolean;
  checked: boolean;
  setEnabled: (enabled: boolean) => void;
  setLocked: (locked: boolean) => void;
  setChecked: (checked: boolean) => void;
}

export const useBiometricLockStore = create<BiometricLockState>((set) => ({
  enabled: false,
  locked: false,
  checked: false,
  setEnabled: (enabled) => set({ enabled }),
  setLocked: (locked) => set({ locked }),
  setChecked: (checked) => set({ checked }),
}));

/** Mount once near the root. Loads the signed-in user's saved preference,
 * re-locks whenever it changes users, and re-locks whenever the app is
 * backgrounded so returning to it always requires another check. */
export function useBiometricLockBootstrap(userId: string | undefined) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const { setEnabled, setLocked, setChecked } = useBiometricLockStore.getState();
    let isMounted = true;
    if (!userId) {
      setEnabled(false);
      setLocked(false);
      setChecked(true);
      return;
    }
    setChecked(false);
    isBiometricLockEnabled(userId).then((isEnabled) => {
      if (!isMounted) return;
      setEnabled(isEnabled);
      setLocked(isEnabled);
      setChecked(true);
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      appState.current = next;
      if (wasActive && next !== 'active' && useBiometricLockStore.getState().enabled) {
        useBiometricLockStore.getState().setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);
}

export async function toggleBiometricLock(userId: string, enabled: boolean) {
  await setBiometricLockEnabled(userId, enabled);
  useBiometricLockStore.getState().setEnabled(enabled);
  useBiometricLockStore.getState().setLocked(false);
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const success = await authenticateWithBiometrics();
  if (success) useBiometricLockStore.getState().setLocked(false);
  return success;
}
