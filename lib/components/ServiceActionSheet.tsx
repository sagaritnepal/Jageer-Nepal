// lib/components/ServiceActionSheet.tsx
import { Modal, Pressable, Text, View } from 'react-native';
import type { ServiceCategory } from '../../types/database.types';

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

export function ServiceActionSheet({
  category,
  onSelect,
  onClose,
}: {
  category: ServiceCategory | null;
  onSelect: (action: (typeof SERVICE_ACTIONS)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!category} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="rounded-t-3xl bg-white p-6 pb-10" onPress={() => {}}>
          <Text className="mb-4 text-center text-base font-bold text-gray-900">{category?.label}</Text>
          <View className="flex-row gap-3">
            {SERVICE_ACTIONS.map((a) => (
              <Pressable
                key={a}
                onPress={() => onSelect(a)}
                className="flex-1 items-center rounded-xl border border-gray-300 bg-white py-3.5"
              >
                <Text className="text-sm font-semibold text-gray-700">{a}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
