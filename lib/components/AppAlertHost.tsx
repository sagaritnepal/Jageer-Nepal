// lib/components/AppAlertHost.tsx
import { Modal, View, Text, Pressable } from 'react-native';
import { useAlertStore, type AlertButton } from '../utils/alert';

// Mount once near the root (see app/_layout.tsx). Renders whatever
// showAlert() queues up as the app's own modal, so it looks and behaves
// the same on every platform instead of falling back to the OS dialog or
// the browser's alert/confirm.
export function AppAlertHost() {
  const queue = useAlertStore((state) => state.queue);
  const dismissCurrent = useAlertStore((state) => state.dismissCurrent);
  const current = queue[0];

  if (!current) return null;

  const isMultiButton = current.buttons.length > 1;

  function handlePress(button: AlertButton) {
    dismissCurrent();
    button.onPress?.();
  }

  function handleRequestClose() {
    // Mirrors Android back-button behavior: only dismiss without an
    // explicit tap if there's a clear "cancel" out, so callers awaiting a
    // button choice (e.g. login.tsx's offerBiometricSignIn) never hang.
    const cancelButton = current.buttons.find((button) => button.style === 'cancel');
    if (!cancelButton) return;
    handlePress(cancelButton);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-gray-900">{current.title}</Text>
          {current.message ? <Text className="mt-2 text-sm text-gray-600">{current.message}</Text> : null}

          <View className={isMultiButton ? 'mt-5 flex-row justify-end gap-2' : 'mt-5'}>
            {current.buttons.map((button, index) => (
              <Pressable
                key={index}
                onPress={() => handlePress(button)}
                className={isMultiButton ? 'rounded-lg px-4 py-2' : 'items-center rounded-lg bg-orange-600 px-4 py-3'}
              >
                <Text
                  className={
                    isMultiButton
                      ? button.style === 'destructive'
                        ? 'text-sm font-semibold text-red-600'
                        : button.style === 'cancel'
                          ? 'text-sm font-semibold text-gray-500'
                          : 'text-sm font-semibold text-orange-600'
                      : 'text-sm font-semibold text-white'
                  }
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
