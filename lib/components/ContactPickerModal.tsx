// lib/components/ContactPickerModal.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildCustomerSuggestions, type CustomerSuggestion } from '../utils/customerSuggestions';
import type { Customer } from '../../types/database.types';
import type { PhoneContactEntry } from '../hooks/usePhoneContacts';

/** Explicit popup for picking a customer name, opened by tapping a
 * customer-name field (see onFocus wiring at each call site) rather than
 * an inline dropdown that expanded on its own - that felt like it was
 * opening itself. Merges saved customers with phone contacts, and always
 * offers "Add as new customer" for whatever's currently typed. */
export function ContactPickerModal({
  visible,
  initialQuery,
  customers,
  phoneContacts,
  onSelectCustomer,
  onSelectNew,
  onClose,
}: {
  visible: boolean;
  initialQuery: string;
  customers: Customer[];
  phoneContacts: PhoneContactEntry[];
  onSelectCustomer: (customer: Customer) => void;
  onSelectNew: (name: string, phone: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(initialQuery);

  useEffect(() => {
    if (visible) setSearch(initialQuery);
  }, [visible, initialQuery]);

  const suggestions = buildCustomerSuggestions(customers, phoneContacts, search);

  function handleSelect(s: CustomerSuggestion) {
    if (s.customer) {
      onSelectCustomer(s.customer);
    } else {
      onSelectNew(s.name, s.phone);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Pick a customer</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search saved customers or phone contacts"
            autoFocus
            className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <FlatList
            data={suggestions}
            keyExtractor={(s) => s.key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: s }) => (
              <Pressable onPress={() => handleSelect(s)} className="flex-row items-center justify-between border-b border-gray-100 px-2 py-2.5">
                <View>
                  <Text className="text-sm font-semibold text-gray-900">{s.name}</Text>
                  {!!s.phone && <Text className="text-xs text-gray-500">{s.phone}</Text>}
                </View>
                {!s.customer && <Ionicons name="person-outline" size={14} color="#9CA3AF" />}
              </Pressable>
            )}
            ListEmptyComponent={<Text className="px-2 py-3 text-center text-sm text-gray-400">No matches.</Text>}
            ListFooterComponent={
              search.trim() ? (
                <Pressable
                  onPress={() => onSelectNew(search.trim(), null)}
                  className="flex-row items-center gap-1.5 px-2 py-2.5"
                >
                  <Ionicons name="add-circle-outline" size={15} color="#EA580C" />
                  <Text className="text-sm font-semibold text-orange-600">Add "{search.trim()}" as a new customer</Text>
                </Pressable>
              ) : null
            }
          />
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
