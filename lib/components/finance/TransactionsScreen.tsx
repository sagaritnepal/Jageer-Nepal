// lib/components/finance/TransactionsScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, SectionList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { DateField } from '../DateTimeFields';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { BusinessTransaction, BusinessTransactionType, CustomerLedgerEntry } from '../../../types/database.types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface ItemRowState {
  description: string;
  qty: string;
  rate: string;
}

function lineTotal(row: ItemRowState) {
  return (Number(row.qty) || 0) * (Number(row.rate) || 0);
}

function ItemRowInput({
  index,
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  item: ItemRowState;
  onChange: (next: ItemRowState) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <View className="mb-2 flex-row items-center gap-1.5">
      <Text className="w-5 text-xs text-gray-400">{index + 1}</Text>
      <TextInput
        value={item.description}
        onChangeText={(v) => onChange({ ...item, description: v })}
        placeholder="Item"
        className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
      />
      <TextInput
        value={item.qty}
        onChangeText={(v) => onChange({ ...item, qty: v })}
        placeholder="Qty"
        keyboardType="numeric"
        className="w-12 rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
      />
      <TextInput
        value={item.rate}
        onChangeText={(v) => onChange({ ...item, rate: v })}
        placeholder="Rate"
        keyboardType="numeric"
        className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
      />
      <Text className="w-16 text-right text-xs font-semibold text-gray-700">{lineTotal(item).toLocaleString()}</Text>
      {canRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close" size={14} color="#9CA3AF" />
        </Pressable>
      ) : (
        <View style={{ width: 14 }} />
      )}
    </View>
  );
}

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

  // Expense: a plain lump amount, unchanged from before.
  const [amount, setAmount] = useState(initial && initial.type === 'expense' ? String(initial.amount) : '');

  // Sale/Purchase: entered as a proper itemized bill.
  const [billNo, setBillNo] = useState(initial?.bill_no ?? '');
  const [billDate, setBillDate] = useState(initial?.bill_date ?? todayIso());
  const [partyAddress, setPartyAddress] = useState(initial?.party_address ?? '');
  const [vatPanNo, setVatPanNo] = useState(initial?.vat_pan_no ?? '');
  const [items, setItems] = useState<ItemRowState[]>(
    initial && initial.items.length > 0
      ? initial.items.map((i) => ({ description: i.description, qty: String(i.qty), rate: String(i.rate) }))
      : [{ description: '', qty: '1', rate: '' }]
  );
  const [discount, setDiscount] = useState(initial ? String(initial.discount_amount) : '0');
  const [vat, setVat] = useState(initial ? String(initial.vat_amount) : '0');

  const [partyName, setPartyName] = useState(initial?.party_name ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const isBill = type !== 'expense';
  const subtotal = items.reduce((sum, row) => sum + lineTotal(row), 0);
  const grandTotal = subtotal - (Number(discount) || 0) + (Number(vat) || 0);

  function updateItem(index: number, next: ItemRowState) {
    setItems((prev) => prev.map((row, i) => (i === index ? next : row)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: '', qty: '1', rate: '' }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (isBill) {
      const validItems = items.filter((r) => r.description.trim() && Number(r.qty) > 0 && Number(r.rate) >= 0);
      if (validItems.length === 0) {
        showAlert('Add at least one item', 'Enter a description, quantity, and rate for at least one item.');
        return;
      }
      if (grandTotal <= 0) {
        showAlert('Check the total', 'The grand total must be more than zero — check item amounts and discount/VAT.');
        return;
      }
      setSaving(true);
      try {
        const values = {
          type,
          amount: grandTotal,
          party_name: partyName.trim() || null,
          note: note.trim() || null,
          bill_no: billNo.trim() || null,
          bill_date: billDate || null,
          party_address: partyAddress.trim() || null,
          vat_pan_no: vatPanNo.trim() || null,
          items: validItems.map((r) => ({
            description: r.description.trim(),
            qty: Number(r.qty),
            rate: Number(r.rate),
            amount: Number(r.qty) * Number(r.rate),
          })),
          discount_amount: Number(discount) || 0,
          vat_amount: Number(vat) || 0,
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
      return;
    }

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
      {isBill ? (
        <>
          <View className="mb-2.5 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">Date</Text>
              <DateField value={billDate} onChange={setBillDate} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">Bill No.</Text>
              <TextInput
                value={billNo}
                onChangeText={setBillNo}
                placeholder="e.g. 0234"
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
              />
            </View>
          </View>
          <TextInput
            value={partyName}
            onChangeText={setPartyName}
            placeholder={type === 'purchase' ? 'Vendor/supplier name' : 'Party name'}
            className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
          <TextInput
            value={partyAddress}
            onChangeText={setPartyAddress}
            placeholder="Address (optional)"
            className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
          <TextInput
            value={vatPanNo}
            onChangeText={setVatPanNo}
            placeholder="VAT/PAN No. (optional)"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />

          <View className="mb-1.5 flex-row items-center gap-1.5">
            <Text className="w-5 text-[10px] font-semibold uppercase text-gray-400">SN</Text>
            <Text className="flex-1 text-[10px] font-semibold uppercase text-gray-400">Item</Text>
            <Text className="w-12 text-[10px] font-semibold uppercase text-gray-400">Qty</Text>
            <Text className="w-16 text-[10px] font-semibold uppercase text-gray-400">Rate</Text>
            <Text className="w-16 text-right text-[10px] font-semibold uppercase text-gray-400">Amount</Text>
            <View style={{ width: 14 }} />
          </View>
          {items.map((item, index) => (
            <ItemRowInput
              key={index}
              index={index}
              item={item}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
              canRemove={items.length > 1}
            />
          ))}
          <Pressable onPress={addItem} className="mb-3 mt-0.5 self-start">
            <Text className="text-xs font-semibold text-orange-600">+ Add item</Text>
          </Pressable>

          <View className="mb-2.5 flex-row justify-between border-t border-gray-100 pt-2.5">
            <Text className="text-xs text-gray-500">Subtotal</Text>
            <Text className="text-xs font-semibold text-gray-700">NPR {subtotal.toLocaleString()}</Text>
          </View>
          <View className="mb-2.5 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">Discount (optional)</Text>
              <TextInput
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">VAT (optional)</Text>
              <TextInput
                value={vat}
                onChangeText={setVat}
                keyboardType="numeric"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </View>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
          <View className="mb-3 flex-row items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
            <Text className="text-sm font-bold text-gray-900">G. Total</Text>
            <Text className="text-base font-extrabold text-gray-900">NPR {grandTotal.toLocaleString()}</Text>
          </View>
        </>
      ) : (
        <>
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
            placeholder="Party name (optional)"
            className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
        </>
      )}
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
          {tx.bill_no ? ` · Bill #${tx.bill_no}` : ''}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {tx.items.length > 0
            ? `${tx.items.length} item${tx.items.length === 1 ? '' : 's'}`
            : (tx.note ?? new Date(tx.created_at).toLocaleDateString())}
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
