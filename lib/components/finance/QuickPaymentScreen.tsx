// lib/components/finance/QuickPaymentScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { Customer } from '../../../types/database.types';

export function QuickPaymentScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isOut = type === 'out';
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const insertEntry = useSupabaseInsert('customer_ledger_entries');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers ?? [];
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  async function handleSave() {
    if (!userId || !selected) return;
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      await insertEntry.mutateAsync({
        customer_id: selected.id,
        owner_id: userId,
        entry_type: isOut ? 'debit' : 'credit',
        amount: value,
        note: note.trim() || null,
        source: 'manual',
      });
      showAlert(
        isOut ? 'Payment out recorded' : 'Payment in recorded',
        `NPR ${value.toLocaleString()} for ${selected.name}.`
      );
      setAmount('');
      setNote('');
      setSelected(null);
      setSearch('');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!selected) {
    return (
      <View className="flex-1 bg-gray-50 px-6 pt-4">
        <Text className="mb-3 text-sm text-gray-500">
          {isOut ? 'Pick who you\'re paying out to.' : 'Pick who this payment is from.'}
        </Text>
        <View className="mb-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone"
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-sm text-gray-900"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4">
              <Text className="font-semibold text-gray-900">{item.name}</Text>
              {!!item.phone && <Text className="mt-0.5 text-xs text-gray-500">{item.phone}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
              <Ionicons name="people-outline" size={28} color="#D1D5DB" />
              <Text className="mt-2 text-gray-500">No customers found.</Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
        <Ionicons name="person" size={16} color="#1d4ed8" />
        <Text className="flex-1 text-sm font-semibold text-blue-700">{selected.name}</Text>
        <Pressable onPress={() => setSelected(null)}>
          <Text className="text-xs font-bold text-blue-700">Change</Text>
        </Pressable>
      </View>

      <Text className="mb-2 text-sm font-medium text-gray-700">
        {isOut ? 'Amount paid out (NPR)' : 'Amount received (NPR)'}
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 1000"
        keyboardType="numeric"
        autoFocus
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Note (optional)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Cash payment"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {saving ? 'Saving…' : isOut ? 'Record payment out' : 'Record payment in'}
        </Text>
      </Pressable>
    </View>
  );
}
