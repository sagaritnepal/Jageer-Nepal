// lib/components/finance/TransactionsScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, SectionList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { BusinessTransaction, BusinessTransactionType, CustomerLedgerEntry } from '../../../types/database.types';

const TYPE_META: Record<BusinessTransactionType, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  sale: { label: 'Sale', color: '#059669', bg: 'bg-emerald-50', icon: 'trending-up' },
  purchase: { label: 'Purchase', color: '#2563eb', bg: 'bg-blue-50', icon: 'cart' },
  expense: { label: 'Expense', color: '#dc2626', bg: 'bg-red-50', icon: 'receipt' },
};

const FILTERS: { key: 'all' | BusinessTransactionType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sale', label: 'Sales' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'expense', label: 'Expense' },
];

function TransactionForm({
  userId,
  initial,
  defaultType,
  onDone,
  onCancel,
}: {
  userId: string;
  initial?: BusinessTransaction;
  defaultType: BusinessTransactionType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const createTx = useSupabaseInsert('business_transactions');
  const updateTx = useSupabaseUpdate('business_transactions');
  const [type, setType] = useState<BusinessTransactionType>(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [partyName, setPartyName] = useState(initial?.party_name ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      const values = {
        type,
        amount: value,
        party_name: partyName.trim() || null,
        note: note.trim() || null,
      };
      if (initial) {
        await updateTx.mutateAsync({ id: initial.id, values });
      } else {
        await createTx.mutateAsync({ owner_id: userId, ...values });
      }
      onDone();
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">{initial ? 'Edit transaction' : 'Add transaction'}</Text>
      <View className="mb-3 flex-row gap-2">
        {(Object.keys(TYPE_META) as BusinessTransactionType[]).map((t) => {
          const meta = TYPE_META[t];
          const selected = type === t;
          return (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className="flex-1 items-center rounded-lg border py-2"
              style={{ borderColor: selected ? meta.color : '#D1D5DB', backgroundColor: selected ? `${meta.color}1A` : 'white' }}
            >
              <Text className="text-xs font-bold" style={{ color: selected ? meta.color : '#6B7280' }}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount (NPR)"
        keyboardType="numeric"
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <TextInput
        value={partyName}
        onChangeText={setPartyName}
        placeholder={type === 'purchase' ? 'Vendor/supplier name (optional)' : 'Party name (optional)'}
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <View className="flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
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

function TransactionRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: BusinessTransaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[tx.type];
  return (
    <Pressable onPress={onEdit} className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <View className={`h-9 w-9 items-center justify-center rounded-full ${meta.bg}`}>
        <Ionicons name={meta.icon} size={16} color={meta.color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">
          {meta.label}
          {tx.party_name ? ` · ${tx.party_name}` : ''}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {tx.note ?? new Date(tx.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text className="text-sm font-extrabold" style={{ color: meta.color }}>
        NPR {tx.amount.toLocaleString()}
      </Text>
      <Pressable onPress={onDelete} hitSlop={8} className="ml-1">
        <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
      </Pressable>
    </Pressable>
  );
}

type FeedItem =
  | { kind: 'business'; id: string; created_at: string; tx: BusinessTransaction }
  | { kind: 'ledger'; id: string; created_at: string; entry: CustomerLedgerEntry; customerName: string | null };

// "Today" / "Yesterday" / "N days ago" for anything in the past; falls back
// to a plain date for anything future-dated (shouldn't normally happen).
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((todayStart - dayStart) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function LedgerRow({ item, basePath }: { item: CustomerLedgerEntry; customerName: string | null; basePath?: string }) {
  const isDebit = item.entry_type === 'debit';
  return (
    <Pressable
      onPress={() => basePath && router.push(`${basePath}/customer/${item.customer_id}` as any)}
      className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <View className={`h-9 w-9 items-center justify-center rounded-full ${isDebit ? 'bg-red-50' : 'bg-emerald-50'}`}>
        <Ionicons name={isDebit ? 'arrow-up' : 'arrow-down'} size={16} color={isDebit ? '#DC2626' : '#059669'} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{isDebit ? 'Customer owes' : 'Received from customer'}</Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {item.note ?? (item.source === 'booking' ? 'From a booked job' : 'Manual entry')} ·{' '}
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text className="text-sm font-extrabold" style={{ color: isDebit ? '#DC2626' : '#059669' }}>
        NPR {item.amount.toLocaleString()}
      </Text>
    </Pressable>
  );
}

export function TransactionsScreen({ basePath }: { basePath?: string }) {
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: ledgerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const deleteTx = useSupabaseDelete('business_transactions');

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const initialFilter = (typeParam as BusinessTransactionType) && ['sale', 'purchase', 'expense'].includes(typeParam ?? '')
    ? (typeParam as BusinessTransactionType)
    : 'all';
  const [filter, setFilter] = useState<'all' | BusinessTransactionType>(initialFilter);
  const [showForm, setShowForm] = useState(!!typeParam);
  const [editingTx, setEditingTx] = useState<BusinessTransaction | null>(null);

  // "All" is a full daily feed across every money-moving table (general
  // sales/purchase/expense entries plus per-customer debit/credit entries),
  // newest first. The type filters stay business_transactions-only, since
  // ledger entries don't have a sale/purchase/expense dimension.
  const feed = useMemo((): FeedItem[] => {
    if (filter !== 'all') {
      return (transactions ?? [])
        .filter((t) => t.type === filter)
        .map((tx) => ({ kind: 'business' as const, id: tx.id, created_at: tx.created_at, tx }));
    }
    const businessItems: FeedItem[] = (transactions ?? []).map((tx) => ({
      kind: 'business',
      id: tx.id,
      created_at: tx.created_at,
      tx,
    }));
    const ledgerItems: FeedItem[] = (ledgerEntries ?? []).map((entry) => ({
      kind: 'ledger',
      id: entry.id,
      created_at: entry.created_at,
      entry,
      customerName: customerNameById.get(entry.customer_id) ?? null,
    }));
    return [...businessItems, ...ledgerItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [transactions, ledgerEntries, customerNameById, filter]);

  // feed is already newest-first, so grouping by day label as we walk it
  // naturally keeps each day's items together in one contiguous section.
  const sections = useMemo(() => {
    const groups: { title: string; data: FeedItem[] }[] = [];
    for (const item of feed) {
      const title = dayLabel(item.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.title === title) {
        lastGroup.data.push(item);
      } else {
        groups.push({ title, data: [item] });
      }
    }
    return groups;
  }, [feed]);

  function handleDelete(tx: BusinessTransaction) {
    showAlert('Delete this transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTx.mutate(tx.id) },
    ]);
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row gap-2">
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 ${selected ? 'bg-orange-500' : 'bg-white border border-gray-200'}`}
              >
                <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-gray-600'}`}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => {
            setEditingTx(null);
            setShowForm((v) => !v);
          }}
          className="h-10 w-10 items-center justify-center rounded-2xl bg-orange-500"
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="white" />
        </Pressable>
      </View>

      {showForm && userId && (
        <TransactionForm
          userId={userId}
          initial={editingTx ?? undefined}
          defaultType={initialFilter === 'all' ? 'sale' : initialFilter}
          onDone={() => {
            setShowForm(false);
            setEditingTx(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingTx(null);
          }}
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderSectionHeader={({ section }) => (
          <Text className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-gray-400">{section.title}</Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'business' ? (
            <TransactionRow
              tx={item.tx}
              onEdit={() => {
                setEditingTx(item.tx);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(item.tx)}
            />
          ) : (
            <LedgerRow item={item.entry} customerName={item.customerName} basePath={basePath} />
          )
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name="cash-outline" size={28} color="#D1D5DB" />
            <Text className="mt-2 text-gray-500">No transactions yet.</Text>
          </View>
        }
      />
    </View>
  );
}
