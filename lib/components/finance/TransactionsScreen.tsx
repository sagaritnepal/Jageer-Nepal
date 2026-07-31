// lib/components/finance/TransactionsScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, View, Text, TextInput, Pressable, SectionList, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { DateField } from '../DateTimeFields';
import { BankAccountPickerModal } from './BankAccountPickerModal';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type {
  BusinessTransaction,
  BusinessTransactionType,
  CustomerLedgerEntry,
  ExpenseCategory,
} from '../../../types/database.types';

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
    <View className="mb-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-gray-400">Item {index + 1}</Text>
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>
      <TextInput
        value={item.description}
        onChangeText={(v) => onChange({ ...item, description: v })}
        placeholder="Item description"
        className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-[11px] font-medium text-gray-500">Qty</Text>
          <TextInput
            value={item.qty}
            onChangeText={(v) => onChange({ ...item, qty: v })}
            keyboardType="numeric"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-[11px] font-medium text-gray-500">Rate</Text>
          <TextInput
            value={item.rate}
            onChangeText={(v) => onChange({ ...item, rate: v })}
            keyboardType="numeric"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-[11px] font-medium text-gray-500">Amount</Text>
          <View className="justify-center rounded-lg bg-gray-100 px-3 py-2.5">
            <Text className="text-sm font-semibold text-gray-700" numberOfLines={1}>
              {lineTotal(item).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
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

function CategoryPickerModal({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  visible: boolean;
  categories: ExpenseCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
    } catch (err) {
      showAlert('Could not add category', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setSaving(true);
    try {
      await onRename(id, renameValue.trim());
      setRenamingId(null);
    } catch (err) {
      showAlert('Could not rename category', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '75%' }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900">Expense categories</Text>
            <Pressable onPress={onClose} className="px-2 py-1">
              <Text className="text-sm font-semibold text-blue-700">Close</Text>
            </Pressable>
          </View>

          <View className="mb-3 flex-row gap-2">
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New category name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <Pressable
              onPress={handleCreate}
              disabled={saving || !newName.trim()}
              className="items-center justify-center rounded-lg bg-orange-500 px-3 disabled:opacity-50"
            >
              <Ionicons name="add" size={18} color="white" />
            </Pressable>
          </View>

          {categories.length === 0 ? (
            <Text className="px-2 py-3 text-center text-sm text-gray-400">No categories yet — add one above.</Text>
          ) : (
            categories.map((cat) => (
              <View key={cat.id} className="mb-1.5 flex-row items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                {renamingId === cat.id ? (
                  <>
                    <TextInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    />
                    <Pressable onPress={() => handleRename(cat.id)} hitSlop={8} disabled={saving}>
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    </Pressable>
                    <Pressable onPress={() => setRenamingId(null)} hitSlop={8}>
                      <Ionicons name="close" size={18} color="#9CA3AF" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => {
                        onSelect(cat.id);
                        onClose();
                      }}
                      className="flex-1 flex-row items-center gap-2 py-1"
                    >
                      {selectedId === cat.id && <Ionicons name="checkmark-circle" size={16} color="#EA580C" />}
                      <Text className="text-sm font-medium text-gray-900">{cat.name}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRenamingId(cat.id);
                        setRenameValue(cat.name);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        showAlert('Remove this category?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => onDelete(cat.id) },
                        ])
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={15} color="#9CA3AF" />
                    </Pressable>
                  </>
                )}
              </View>
            ))
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TransactionForm({
  userId,
  initial,
  type,
  existingNames,
  onDone,
  onCancel,
}: {
  userId: string;
  initial?: BusinessTransaction;
  type: BusinessTransactionType;
  existingNames: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const createTx = useSupabaseInsert('business_transactions');
  const updateTx = useSupabaseUpdate('business_transactions');
  const { data: categories } = useSupabaseQuery('expense_categories', {
    filters: { owner_id: userId },
    orderBy: { column: 'name' },
  });
  const createCategory = useSupabaseInsert('expense_categories');
  const updateCategory = useSupabaseUpdate('expense_categories');
  const deleteCategory = useSupabaseDelete('expense_categories');
  const bankAccounts = useBankAccounts(userId);

  // Expense: date + addable name + a managed category + amount + remark.
  const [amount, setAmount] = useState(initial && initial.type === 'expense' ? String(initial.amount) : '');
  const [expenseDate, setExpenseDate] = useState(initial?.bill_date ?? todayIso());
  const [categoryId, setCategoryId] = useState<string | null>(initial?.expense_category_id ?? null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

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
  const [bankAccountId, setBankAccountId] = useState<string | null>(initial?.bank_account_id ?? null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const isBill = type !== 'expense';
  const subtotal = items.reduce((sum, row) => sum + lineTotal(row), 0);
  const grandTotal = subtotal - (Number(discount) || 0) + (Number(vat) || 0);
  const selectedCategory = (categories ?? []).find((c) => c.id === categoryId) ?? null;
  const selectedAccountName = bankAccountId
    ? bankAccounts.accounts.find((a) => a.id === bankAccountId)?.name ?? 'Cash'
    : 'Cash';

  const nameSuggestions = useMemo(() => {
    const q = partyName.trim().toLowerCase();
    if (!q) return [];
    return existingNames.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 5);
  }, [existingNames, partyName]);

  async function handleCreateCategory(name: string) {
    const created = await createCategory.mutateAsync({ owner_id: userId, name });
    setCategoryId(created.id);
  }
  async function handleRenameCategory(id: string, name: string) {
    await updateCategory.mutateAsync({ id, values: { name } });
  }
  async function handleDeleteCategory(id: string) {
    await deleteCategory.mutateAsync(id);
    if (categoryId === id) setCategoryId(null);
  }

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
          payment_mode: bankAccountId ? ('bank' as const) : ('cash' as const),
          bank_account_id: bankAccountId,
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
        bill_date: expenseDate || null,
        expense_category_id: categoryId,
        payment_mode: bankAccountId ? ('bank' as const) : ('cash' as const),
        bank_account_id: bankAccountId,
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
          <Text className="mb-1 text-xs font-medium text-gray-500">Date</Text>
          <View className="mb-2.5">
            <DateField value={expenseDate} onChange={setExpenseDate} />
          </View>

          <Text className="mb-1 text-xs font-medium text-gray-500">Name</Text>
          <TextInput
            value={partyName}
            onChangeText={(v) => {
              setPartyName(v);
              setShowNameSuggestions(true);
            }}
            onFocus={() => setShowNameSuggestions(true)}
            placeholder="Who was this paid to?"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
          {showNameSuggestions && nameSuggestions.length > 0 && (
            <View className="mb-1 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {nameSuggestions.map((n, idx) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    setPartyName(n);
                    setShowNameSuggestions(false);
                  }}
                  className={`px-3 py-2 ${idx !== nameSuggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <Text className="text-sm text-gray-900">{n}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text className="mb-2.5 mt-1 text-[11px] text-gray-400">
            Pick a name already used before, or type a new one — it'll be remembered next time.
          </Text>

          <Text className="mb-1 text-xs font-medium text-gray-500">Expense category</Text>
          <Pressable
            onPress={() => setShowCategoryPicker(true)}
            className="mb-2.5 flex-row items-center justify-between rounded-lg border border-gray-300 px-3 py-2.5"
          >
            <Text className={`text-sm ${selectedCategory ? 'text-gray-900' : 'text-gray-400'}`}>
              {selectedCategory?.name ?? 'Select a category'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>

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
            placeholder="Remark (optional)"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />

          <CategoryPickerModal
            visible={showCategoryPicker}
            categories={categories ?? []}
            selectedId={categoryId}
            onSelect={setCategoryId}
            onClose={() => setShowCategoryPicker(false)}
            onCreate={handleCreateCategory}
            onRename={handleRenameCategory}
            onDelete={handleDeleteCategory}
          />
        </>
      )}

      <Text className="mb-1 text-xs font-medium text-gray-500">Payment account</Text>
      <Pressable
        onPress={() => setShowAccountPicker(true)}
        className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-300 px-3 py-2.5"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name={bankAccountId ? 'business-outline' : 'cash-outline'} size={16} color="#6B7280" />
          <Text className="text-sm text-gray-900">{selectedAccountName}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
      </Pressable>
      <BankAccountPickerModal
        visible={showAccountPicker}
        accounts={bankAccounts.accounts}
        selectedId={bankAccountId}
        onSelect={setBankAccountId}
        onClose={() => setShowAccountPicker(false)}
        onCreate={bankAccounts.create}
        onRename={bankAccounts.rename}
        onDelete={bankAccounts.remove}
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
  categoryName,
  bankAccountName,
  onEdit,
  onDelete,
}: {
  tx: BusinessTransaction;
  categoryName: string | null;
  bankAccountName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[tx.type];
  const accountLabel = tx.bank_account_id ? bankAccountName ?? 'Bank' : 'Cash';
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
          {categoryName ? ` · ${categoryName}` : ''}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {tx.items.length > 0
            ? `${tx.items.length} item${tx.items.length === 1 ? '' : 's'}`
            : (tx.note ?? new Date(tx.created_at).toLocaleDateString())}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-extrabold" style={{ color: meta.color }}>
          NPR {tx.amount.toLocaleString()}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          <Ionicons name={tx.bank_account_id ? 'business-outline' : 'cash-outline'} size={10} color="#9CA3AF" />
          <Text className="text-[10px] text-gray-400" numberOfLines={1}>
            {accountLabel}
          </Text>
        </View>
      </View>
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
  const { data: categories } = useSupabaseQuery('expense_categories', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const bankAccounts = useBankAccounts(userId);
  const deleteTx = useSupabaseDelete('business_transactions');

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const bankAccountNameById = useMemo(() => {
    const map = new Map<string, string>();
    bankAccounts.accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [bankAccounts.accounts]);

  // Previously used expense payee names, so the Name field can suggest one
  // instead of always starting from scratch.
  const existingExpenseNames = useMemo(() => {
    const names = new Set<string>();
    (transactions ?? []).forEach((t) => {
      if (t.type === 'expense' && t.party_name) names.add(t.party_name);
    });
    return Array.from(names);
  }, [transactions]);

  const initialFilter = (typeParam as BusinessTransactionType) && ['sale', 'purchase', 'expense'].includes(typeParam ?? '')
    ? (typeParam as BusinessTransactionType)
    : 'all';
  const [filter, setFilter] = useState<'all' | BusinessTransactionType>(initialFilter);
  const [showForm, setShowForm] = useState(!!typeParam);
  const [editingTx, setEditingTx] = useState<BusinessTransaction | null>(null);

  // Expo Router reuses this same screen instance when navigating between
  // shortcuts that share this route (Sales/Purchase/Expense/Net
  // Balance/Transactions all point here with a different or absent ?type=),
  // so the state above - set from typeParam only on first mount - would
  // otherwise go stale: the form would keep showing whatever type/filter was
  // active before, no matter which shortcut was actually tapped. Re-sync
  // whenever the param itself changes instead.
  useEffect(() => {
    setFilter(initialFilter);
    setShowForm(!!typeParam);
    setEditingTx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeParam]);

  // Pressing the Android hardware back button while the add/edit form is
  // open should close the form first, same as the explicit back-chevron
  // does when the view is locked to a type - not immediately leave the
  // whole Transactions screen with the form still hanging open behind it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showForm) {
        setShowForm(false);
        setEditingTx(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showForm]);

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

  // Arriving with a specific ?type= (from the Sales/Purchase/Expense
  // shortcuts or dashboard cards) means "show me only this" - lock the view
  // to that one type instead of dropping the reseller into the shared
  // All/Sales/Purchase/Expense hub they'd then have to filter themselves.
  // The Transactions shortcut (no type param) still opens that full hub.
  const isLockedToType = !!typeParam && initialFilter !== 'all';

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        ListHeaderComponent={
          <>
            <View className="mb-3 flex-row items-center justify-between">
              {isLockedToType ? (
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => {
                      if (showForm) {
                        setShowForm(false);
                        setEditingTx(null);
                      } else {
                        router.back();
                      }
                    }}
                    hitSlop={8}
                    className="p-1"
                  >
                    <Ionicons name="chevron-back" size={20} color="#374151" />
                  </Pressable>
                  <Text className="text-base font-bold text-gray-900">{TYPE_META[initialFilter].label}</Text>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  {FILTERS.map((f) => {
                    const selected = filter === f.key;
                    return (
                      <Pressable
                        key={f.key}
                        onPress={() => setFilter(f.key)}
                        className={`rounded-full px-3 py-1.5 ${selected ? 'bg-orange-500' : 'bg-white border border-gray-200'}`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-gray-600'}`}>
                          {f.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {!isLockedToType && (
                <Pressable
                  onPress={() => {
                    setEditingTx(null);
                    setShowForm((v) => !v);
                  }}
                  className="h-10 w-10 items-center justify-center rounded-2xl bg-orange-500"
                >
                  <Ionicons name={showForm ? 'close' : 'add'} size={20} color="white" />
                </Pressable>
              )}
            </View>

            {showForm && userId && (
              <TransactionForm
                userId={userId}
                initial={editingTx ?? undefined}
                type={editingTx?.type ?? (filter === 'all' ? 'sale' : filter)}
                existingNames={existingExpenseNames}
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
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-gray-400">{section.title}</Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'business' ? (
            <TransactionRow
              tx={item.tx}
              categoryName={item.tx.expense_category_id ? categoryNameById.get(item.tx.expense_category_id) ?? null : null}
              bankAccountName={item.tx.bank_account_id ? bankAccountNameById.get(item.tx.bank_account_id) ?? null : null}
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
        keyboardShouldPersistTaps="handled"
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
