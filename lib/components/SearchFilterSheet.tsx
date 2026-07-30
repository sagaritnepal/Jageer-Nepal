// lib/components/SearchFilterSheet.tsx
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Search itself now lives directly in the search bar (real TextInput, live
// filtering) - this sheet is just the category picker. Tapping a pill
// applies it and closes immediately, so there's no separate Clear/Apply step.
export function SearchFilterSheet({
  visible,
  category,
  categories,
  onSelect,
  onClose,
}: {
  visible: boolean;
  category: string | null;
  categories: string[];
  onSelect: (category: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  function choose(next: string | null) {
    onSelect(next);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-white p-6"
          style={{ paddingBottom: insets.bottom + 24 }}
          onPress={() => {}}
        >
          <Text className="mb-4 text-base font-bold text-gray-900">Filter by category</Text>

          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => choose(null)}
              className={`rounded-full border px-3 py-1.5 ${
                category === null ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-white'
              }`}
            >
              <Text className={category === null ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-600'}>
                All
              </Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable
                key={c}
                onPress={() => choose(c)}
                className={`rounded-full border px-3 py-1.5 ${
                  category === c ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-white'
                }`}
              >
                <Text className={category === c ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-600'}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
