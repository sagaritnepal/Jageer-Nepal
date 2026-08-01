// lib/components/finance/CustomerSearchModal.tsx
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Customer } from '../../../types/database.types';

// Full browse/search picker over the reseller's whole saved customer book -
// the inline as-you-type suggestions only show a handful of matches, so this
// is what makes all of them (216+ in some cases) actually reachable.
export function CustomerSearchModal({
  visible,
  customers,
  search,
  onSearchChange,
  onSelect,
  onClose,
}: {
  visible: boolean;
  customers: Customer[];
  search: string;
  onSearchChange: (text: string) => void;
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">My Customers</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search by name"
            autoFocus
            className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {customers.length === 0 ? (
              <Text className="px-2 py-3 text-center text-sm text-gray-400">No saved customers match.</Text>
            ) : (
              customers.map((c) => (
                <Pressable key={c.id} onPress={() => onSelect(c)} className="border-b border-gray-100 px-2 py-2.5">
                  <Text className="text-sm font-semibold text-gray-900">{c.name}</Text>
                  {!!c.phone && <Text className="text-xs text-gray-500">{c.phone}</Text>}
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
