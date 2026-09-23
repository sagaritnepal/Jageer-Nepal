// lib/components/HoldRequestModal.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';

/** The note-entry dialog a technician fills in before asking to pause a job -
 * opened by the "Hold" button on the job detail screen. Submitting sends the
 * request to the reseller (see requestJobHold); this component only owns the
 * note text and the visible/submitting state. */
export function HoldRequestModal({
  visible,
  submitting,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  submitting: boolean;
  onSubmit: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) setNote('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-4">
            <Text className="mb-1 text-base font-bold text-gray-900">Put this job on hold</Text>
            <Text className="mb-3 text-xs text-gray-500">
              Explain why - this goes straight to the reseller, who can accept or reject it.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Waiting on a part, back tomorrow"
              multiline
              numberOfLines={4}
              autoFocus
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={onClose}
                disabled={submitting}
                className="flex-1 items-center rounded-lg border border-gray-300 py-2.5 disabled:opacity-50"
              >
                <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onSubmit(note.trim())}
                disabled={submitting || !note.trim()}
                className="flex-1 items-center rounded-lg bg-amber-600 py-2.5 disabled:opacity-40"
              >
                <Text className="text-sm font-semibold text-white">{submitting ? 'Sending…' : 'Request hold'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
