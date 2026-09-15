// lib/utils/alert.ts
import { create } from 'zustand';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

interface AlertStoreState {
  queue: AlertRequest[];
  enqueue: (request: AlertRequest) => void;
  dismissCurrent: () => void;
}

// Backs AppAlertHost (mounted once in the root layout), which is the only
// thing that reads this queue. Keeping it here (rather than a separate
// store file) keeps showAlert's implementation and its state next to each
// other.
export const useAlertStore = create<AlertStoreState>((set) => ({
  queue: [],
  enqueue: (request) => set((state) => ({ queue: [...state.queue, request] })),
  dismissCurrent: () => set((state) => ({ queue: state.queue.slice(1) })),
}));

let nextAlertId = 0;

// Renders through the app's own AppAlertHost modal instead of the OS
// system dialog (native Alert.alert) or the browser's window.alert/confirm
// (react-native-web ships Alert.alert as a no-op). One implementation for
// every platform means the same look everywhere and support for
// async/multi-button flows (see login.tsx's offerBiometricSignIn) that
// window.confirm can't do.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  useAlertStore.getState().enqueue({ id: nextAlertId++, title, message, buttons: resolvedButtons });
}

// `err instanceof Error` misses native errors that don't inherit from Error
// (e.g. some browser fetch/geolocation failures), which silently swallowed
// the real message behind a generic fallback. This checks for a `.message`
// string on anything thrown, not just true Error instances.
export function getErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    const message = (err as { message: string }).message;
    if (message) return message;
  }
  return fallback;
}
