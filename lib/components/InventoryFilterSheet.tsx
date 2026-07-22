// lib/components/InventoryFilterSheet.tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

export function InventoryFilterSheet({
  visible,
  initialSearch,
  initialCategory,
  categories,
  onApply,
  onClose,
}: {
  visible: boolean;
  initialSearch: string;
  initialCategory: string | null;
  categories: string[];
  onApply: (values: { search: string; category: string | null }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);

  // Re-sync draft state to whatever's currently applied each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSearch(initialSearch);
      setCategory(initialCategory);
    }
  }, [visible, initialSearch, initialCategory]);

  function handleApply() {
    onApply({ search, category });
    onClose();
  }

  function handleClear() {
    onApply({ search: '', category: null });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="rounded-t-3xl bg-white p-6 pb-10" onPress={() => {}}>
          <Text className="mb-4 text-base font-bold text-gray-900">Search &amp; Filter</Text>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Name or model</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="e.g. Dell Latitude"
            placeholderTextColor="#9CA3AF"
            autoFocus
            className="mb-5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />

          {categories.length > 0 && (
            <>
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Category</Text>
              <View className="mb-6 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => setCategory(null)}
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
                    onPress={() => setCategory(c)}
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
            </>
          )}

          <View className="flex-row gap-3">
            <Pressable onPress={handleClear} className="flex-1 items-center rounded-xl border border-gray-300 py-3">
              <Text className="text-sm font-semibold text-gray-700">Clear</Text>
            </Pressable>
            <Pressable onPress={handleApply} className="flex-1 items-center rounded-xl bg-orange-500 py-3">
              <Text className="text-sm font-semibold text-white">Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
