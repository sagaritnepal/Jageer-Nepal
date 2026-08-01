// lib/components/finance/QuickPaymentScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../hooks/useSupabase';
import { CustomerSearchModal } from './CustomerSearchModal';
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

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const nameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    return (customers ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customerName]);

  const customerSearchResults = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = customers ?? [];
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, customerSearch]);

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setShowNameSuggestions(false);
    setShowCustomerPicker(false);
  }

  async function handleSave() {
    if (!userId) return;
    if (!selectedCustomer) {
      showAlert('Select a customer', 'Search or pick a saved customer for this payment.');
      return;
    }
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      await insertEntry.mutateAsync({
        customer_id: selectedCustomer.id,
        owner_id: userId,
        entry_type: isOut ? 'debit' : 'credit',
        amount: value,
        note: note.trim() || null,
        source: 'manual',
      });
      showAlert(
        isOut ? 'Payment out recorded' : 'Payment in recorded',
        `NPR ${value.toLocaleString()} for ${selectedCustomer.name}.`
      );
      setAmount('');
      setNote('');
      setSelectedCustomer(null);
      setCustomerName('');
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const meta = isOut
    ? { label: 'Payment Out', color: '#DC2626', bg: 'bg-red-50', icon: 'arrow-up-circle' as const }
    : { label: 'Payment In', color: '#059669', bg: 'bg-emerald-50', icon: 'arrow-down-circle' as const };

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className={`mb-4 flex-row items-center gap-2 rounded-2xl p-4 ${meta.bg}`}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
        <Text className="text-base font-bold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-1 text-xs font-medium text-gray-500">Customer</Text>
        <View className="mb-1 flex-row items-center rounded-lg border border-gray-300 bg-white">
          <TextInput
            value={customerName}
            onChangeText={(v) => {
              setCustomerName(v);
              setSelectedCustomer(null);
              setShowNameSuggestions(true);
            }}
            onFocus={() => setShowNameSuggestions(true)}
            placeholder={isOut ? "Who are you paying?" : 'Who is this payment from?'}
            className="flex-1 px-3 py-2.5 text-sm text-gray-900"
          />
          <Pressable
            onPress={() => {
              setCustomerSearch('');
              setShowCustomerPicker(true);
            }}
            hitSlop={8}
            className="px-2.5"
          >
            <Ionicons name="book-outline" size={18} color="#1d4ed8" />
          </Pressable>
        </View>
        {showNameSuggestions && nameSuggestions.length > 0 && (
          <View className="mb-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {nameSuggestions.map((c, idx) => (
              <Pressable
                key={c.id}
                onPress={() => selectCustomer(c)}
                className={`px-3 py-2 ${idx !== nameSuggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <Text className="text-sm font-medium text-gray-900">{c.name}</Text>
                {!!c.phone && <Text className="text-xs text-gray-500">{c.phone}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        {selectedCustomer && (
          <View className="mb-1 flex-row items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2">
            <Ionicons name="checkmark-circle" size={14} color="#1d4ed8" />
            <Text className="flex-1 text-xs font-medium text-blue-700">Using saved customer</Text>
          </View>
        )}
        <Text className="mb-3 mt-1 text-[11px] text-gray-400">
          Tap the book icon to search your {(customers ?? []).length} saved customers.
        </Text>

        <Text className="mb-1 text-xs font-medium text-gray-500">
          {isOut ? 'Amount paid out (NPR)' : 'Amount received (NPR)'}
        </Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 1000"
          keyboardType="numeric"
          className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
        />

        <Text className="mb-1 text-xs font-medium text-gray-500">Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Cash payment"
          className="mb-4 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="items-center rounded-lg py-3 disabled:opacity-50"
          style={{ backgroundColor: meta.color }}
        >
          <Text className="text-base font-semibold text-white">
            {saving ? 'Saving…' : isOut ? 'Record payment out' : 'Record payment in'}
          </Text>
        </Pressable>
      </View>

      <CustomerSearchModal
        visible={showCustomerPicker}
        customers={customerSearchResults}
        search={customerSearch}
        onSearchChange={setCustomerSearch}
        onSelect={selectCustomer}
        onClose={() => setShowCustomerPicker(false)}
      />
    </ScrollView>
  );
}
