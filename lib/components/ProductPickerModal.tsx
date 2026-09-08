// lib/components/ProductPickerModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toSafeImageUri } from '../utils/image';
import type { Product } from '../../types/database.types';

/** Popup for picking one of the reseller's own listed products as a
 * quotation line item - reuses its photo/name/price so the reseller doesn't
 * retype specs the catalog already has. Modeled on ContactPickerModal.tsx's
 * search + list + modal shape. */
export function ProductPickerModal({
  visible,
  products,
  onSelect,
  onClose,
}: {
  visible: boolean;
  products: Product[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Pick a product</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your products"
            autoFocus
            className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: p }) => (
              <Pressable
                onPress={() => onSelect(p)}
                className="flex-row items-center gap-2.5 border-b border-gray-100 px-2 py-2.5"
              >
                <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {toSafeImageUri(p.image_url) ? (
                    <Image source={{ uri: toSafeImageUri(p.image_url)! }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <Text>🖥️</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text className="text-xs text-gray-500">NPR {p.price.toLocaleString()}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text className="px-2 py-3 text-center text-sm text-gray-400">No products found.</Text>}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
