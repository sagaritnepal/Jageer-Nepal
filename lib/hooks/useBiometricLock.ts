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

/** Mount once near the root. Loads the signed-in user's saved preference
 * and re-locks whenever the app is backgrounded so returning to it always
 * requires another check. Deliberately does NOT lock right when `userId`
 * first appears (i.e. right after any fresh sign-in, password or
 * fingerprint) - the user just actively proved who they are to get that
 * session, so immediately demanding another biometric check on top of a
 * fingerprint sign-in was a redundant double-prompt. */
const BACKGROUND_LOCK_GRACE_MS = 5 * 60 * 1000;

export function useBiometricLockBootstrap(userId: string | undefined) {
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

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
      setLocked(false);
      setChecked(true);
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const returningToActive = !wasActive && next === 'active';

      if (wasActive && next !== 'active') {
        backgroundedAt.current = Date.now();
      } else if (returningToActive && useBiometricLockStore.getState().enabled) {
        // Re-lock only after a real backgrounding, not a quick screen
        // lock/unlock - re-scanning a fingerprint every single time the
        // phone screen so much as locks was reported as too aggressive, so
        // only demand it again once the app has actually been away for a
        // while (someone could've handed the unlocked phone to someone
        // else in that time).
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : Infinity;
        if (elapsed >= BACKGROUND_LOCK_GRACE_MS) {
          useBiometricLockStore.getState().setLocked(true);
        }
      }
      appState.current = next;
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
