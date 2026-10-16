// lib/utils/askSave.ts
import { showAlert } from './alert';

/** A Save / Cancel question: resolves true on Save, false on Cancel. */
export function askSave(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Save', onPress: () => resolve(true) },
    ]);
  });
}
