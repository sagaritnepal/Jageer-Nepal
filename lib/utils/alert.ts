// lib/utils/alert.ts
import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

// react-native-web ships Alert.alert as a total no-op (`static alert() {}`),
// so on web this falls back to window.alert/window.confirm to actually
// show the user something instead of silently doing nothing.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b !== cancelButton) ?? buttons[0];
  if (window.confirm(text)) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
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
