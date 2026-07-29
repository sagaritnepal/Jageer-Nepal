// lib/components/finance/CustomerDetailScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import {
  useSupabaseRow,
  useSupabaseQuery,
  useSupabaseUpdate,
  useSupabaseInsert,
  useSupabaseDelete,
} from '../../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { LedgerEntryType } from '../../../types/database.types';

function EditableDetails({ customerId, basePath }: { customerId: string; basePath: string }) {
  const { data: customer } = useSupabaseRow('customers', customerId);
  const updateCustomer = useSupabaseUpdate('customers');
  const deleteCustomer = useSupabaseDelete('customers');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  if (!customer) return null;

  function startEditing() {
    setName(customer!.name);
    setPhone(customer!.phone ?? '');
    setAddress(customer!.address ?? '');
    setEditing(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert('Add a name', "Enter the customer's name.");
      return;
    }
    setSaving(true);
    try {
      await updateCustomer.mutateAsync({
        id: customerId,
        values: { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null },
      });
      setEditing(false);
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    showAlert('Delete this customer?', 'Their saved contact info and ledger history will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer.mutateAsync(customerId);
            router.replace(`${basePath}/customers` as any);
          } catch (err) {
            showAlert('Could not delete', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  if (editing) {
    return (
      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-3 text-sm font-semibold text-gray-900">Edit customer</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone"
          keyboardType="phone-pad"
          className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
          className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
        />
        <View className="flex-row gap-2">
          <Pressable onPress={() => setEditing(false)} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
            <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="flex-1 text-lg font-bold text-gray-900">{customer.name}</Text>
        <View className="flex-row gap-3">
          <Pressable onPress={startEditing} hitSlop={8}>
            <Ionicons name="pencil" size={16} color="#2563eb" />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
          </Pressable>
        </View>
      </View>
      {customer.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${customer.phone}`)} className="mb-1 flex-row items-center gap-1.5">
          <Ionicons name="call-outline" size={13} color="#6B7280" />
          <Text className="text-sm text-blue-700">{customer.phone}</Text>
        </Pressable>
      )}
      {customer.address && (
        <Pressable
          onPress={() =>
            customer.latitude != null && customer.longitude != null
              ? Linking.openURL(`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`)
              : undefined
          }
          className="flex-row items-start gap-1.5"
        >
          <Ionicons name="location-outline" size={13} color="#6B7280" style={{ marginTop: 1.5 }} />
          <Text className="flex-1 text-sm text-gray-600">{customer.address}</Text>
        </Pressable>
      )}
    </View>
  );
}

function AddEntryForm({ customerId, ownerId, onDone }: { customerId: string; ownerId: string; onDone: () => void }) {
  const insertEntry = useSupabaseInsert('customer_ledger_entries');
  const [entryType, setEntryType] = useState<LedgerEntryType>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      await insertEntry.mutateAsync({
        customer_id: customerId,
        owner_id: ownerId,
        entry_type: entryType,
        amount: value,
        note: note.trim() || null,
        source: 'manual',
      });
      onDone();
    } catch (err) {
      showAlert('Could not add entry', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">Add ledger entry</Text>
      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => setEntryType('credit')}
          className={`flex-1 items-center rounded-lg border py-2 ${entryType === 'credit' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
        >
          <Text className={`text-xs font-bold ${entryType === 'credit' ? 'text-emerald-700' : 'text-gray-500'}`}>
            Payment received
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEntryType('debit')}
          className={`flex-1 items-center rounded-lg border py-2 ${entryType === 'debit' ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}
        >
          <Text className={`text-xs font-bold ${entryType === 'debit' ? 'text-red-700' : 'text-gray-500'}`}>
            Customer owes
          </Text>
        </Pressable>
      </View>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount (NPR)"
        keyboardType="numeric"
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <View className="flex-row gap-2">
        <Pressable onPress={onDone} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Add entry'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CustomerDetailScreen({ basePath }: { basePath: string }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: entries } = useSupabaseQuery('customer_ledger_entries', {
    filters: { customer_id: id },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!id,
  });
  const deleteEntry = useSupabaseDelete('customer_ledger_entries');
  const [showAddEntry, setShowAddEntry] = useState(false);

  const balance = useMemo(() => {
    return (entries ?? []).reduce((sum, e) => sum + (e.entry_type === 'debit' ? e.amount : -e.amount), 0);
  }, [entries]);

  if (!id || !userId) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <EditableDetails customerId={id} basePath={basePath} />

      <View className="mb-4 rounded-2xl bg-gray-900 p-5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {balance > 0 ? 'Customer owes you' : balance < 0 ? 'You owe customer' : 'Balance'}
        </Text>
        <Text className={`mt-1 text-2xl font-extrabold ${balance > 0 ? 'text-red-400' : balance < 0 ? 'text-emerald-400' : 'text-white'}`}>
          NPR {Math.abs(balance).toLocaleString()}
        </Text>
      </View>

      {!showAddEntry && (
        <Pressable
          onPress={() => setShowAddEntry(true)}
          className="mb-4 flex-row items-center justify-center gap-1.5 rounded-lg bg-orange-500 py-3"
        >
          <Ionicons name="add-circle-outline" size={16} color="white" />
          <Text className="text-sm font-semibold text-white">Add ledger entry</Text>
        </Pressable>
      )}
      {showAddEntry && <AddEntryForm customerId={id} ownerId={userId} onDone={() => setShowAddEntry(false)} />}

      <Text className="mb-2 text-sm font-semibold text-gray-900">History</Text>
      {(entries ?? []).length === 0 && (
        <Text className="text-center text-sm text-gray-400">No ledger entries yet.</Text>
      )}
      {(entries ?? []).map((entry) => (
        <View key={entry.id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5">
          <View
            className={`h-8 w-8 items-center justify-center rounded-full ${entry.entry_type === 'debit' ? 'bg-red-50' : 'bg-emerald-50'}`}
          >
            <Ionicons
              name={entry.entry_type === 'debit' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={entry.entry_type === 'debit' ? '#DC2626' : '#059669'}
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900">
              {entry.entry_type === 'debit' ? 'Owes' : 'Paid'} NPR {entry.amount.toLocaleString()}
            </Text>
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {entry.note ?? (entry.source === 'booking' ? 'From a booked job' : 'Manual entry')} ·{' '}
              {new Date(entry.created_at).toLocaleDateString()}
            </Text>
          </View>
          {entry.source === 'manual' && (
            <Pressable
              onPress={() =>
                showAlert('Remove this entry?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => deleteEntry.mutate(entry.id) },
                ])
              }
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
