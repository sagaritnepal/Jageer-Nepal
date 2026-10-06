// lib/components/finance/CustomerDetailScreen.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, Linking, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { BankAccountPickerModal } from './BankAccountPickerModal';
import { PartyTypePill } from './PartyBalance';
import { PartyTypeField } from './PartyTypeField';
import { TransactionDetailModal } from './TransactionsScreen';
import { BackButton, BookTable, Pill, ToolbarButton, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { Field, FieldRow, FormActions, FormCard, INPUT, PopupCard, Segmented } from './FormKit';
import { MONEY } from './moneyColors';
import { supabase } from '../../supabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { nameCaps } from '../../utils/nameCaps';
import { deleteErrorMessage } from '../../utils/dbErrors';
import { fetchAllRows } from '../../utils/fetchAllRows';
import { isValidPhone10 } from '../../utils/phone';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import type {
  BusinessTransaction,
  BusinessTransactionType,
  CustomerLedgerEntry,
  LedgerEntryType,
  VendorLedgerEntry,
} from '../../../types/database.types';

const TX_TYPE_LABEL: Record<BusinessTransactionType, string> = {
  sale: 'Sale bill',
  purchase: 'Purchase bill',
  expense: 'Expense',
};

// The two colours a choice or tag takes: green for money in, red for money out.
const IN_TONE = { color: MONEY.in.text, bg: MONEY.in.bg, border: MONEY.in.base };
const OUT_TONE = { color: MONEY.out.text, bg: MONEY.out.bg, border: MONEY.out.base };
const NEUTRAL_TONE = { color: '#374151', bg: '#F3F4F6', border: '#9CA3AF' };

/** Whether `phone` is already used by a different customer of this owner. */
async function phoneAlreadyUsed(ownerId: string, phone: string, excludeCustomerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('phone', phone)
    .neq('id', excludeCustomerId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** One balance in the name card: its label and the reason in plain words on one
 * small line, the coloured amount under it. */
function BalanceFigure({ label, value, color, caption }: { label: string; value: string; color: string; caption?: string }) {
  return (
    <View>
      <Text className="text-[10.5px]" numberOfLines={1}>
        <Text className="font-bold uppercase tracking-wide text-gray-400">{label}</Text>
        {!!caption && <Text className="text-gray-400">{`  ·  ${caption}`}</Text>}
      </Text>
      <Text className="text-[17px] font-extrabold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}

/** A small outlined button for the header: an icon and a word. */
function HeaderButton({ icon, label, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-8 flex-row items-center rounded-lg border px-2.5"
      style={{ gap: 5, borderColor: danger ? '#FECACA' : '#D1D5DB', backgroundColor: danger ? '#FEF2F2' : '#FFFFFF' }}
    >
      <Ionicons name={icon} size={13} color={danger ? '#DC2626' : '#2563EB'} />
      <Text className="text-[12.5px] font-semibold" style={{ color: danger ? '#DC2626' : '#374151' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function EditableDetails({ customerId, basePath, summary }: { customerId: string; basePath: string; summary?: ReactNode }) {
  const { data: customer } = useSupabaseRow('customers', customerId);
  const updateCustomer = useSupabaseUpdate('customers');
  const deleteCustomer = useSupabaseDelete('customers', { requireRow: true });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [partyTypeId, setPartyTypeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { nameById: partyTypeName } = usePartyTypes(customer?.owner_id);

  if (!customer) return null;

  function startEditing() {
    setName(nameCaps(customer!.name));
    setPhone(customer!.phone ?? '');
    setAddress(customer!.address ?? '');
    setPartyTypeId(customer!.party_type_id ?? null);
    setEditing(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert('Add a name', "Enter the customer's name.");
      return;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidPhone10(trimmedPhone)) {
      showAlert('Check the phone number', 'Enter a valid 10-digit phone number.');
      return;
    }
    setSaving(true);
    try {
      if (trimmedPhone && (await phoneAlreadyUsed(customer!.owner_id, trimmedPhone, customerId))) {
        showAlert('Already saved', 'A customer with this phone number already exists.');
        return;
      }
      await updateCustomer.mutateAsync({
        id: customerId,
        values: {
          name: nameCaps(name.trim()),
          phone: trimmedPhone || null,
          address: address.trim() || null,
          // Only when changed, so saving a party never depends on the type column.
          ...(partyTypeId !== (customer!.party_type_id ?? null) ? { party_type_id: partyTypeId } : {}),
        },
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
            showAlert('Could not delete', deleteErrorMessage(err, 'this person'));
          }
        },
      },
    ]);
  }

  // Editing opens in a popup over the page; the name card stays as it is behind it.
  const editPopup = editing ? (
    <PopupCard title="Edit customer" onClose={() => setEditing(false)}>
      <FieldRow>
        <Field label="Name" basis={240}>
          <TextInput
            value={name}
            onChangeText={(v) => setName(nameCaps(v))}
            autoCapitalize="characters"
            autoFocus
            placeholder="Name"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
        <Field label="Phone (10 digits)" basis={180}>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
            placeholder="98XXXXXXXX"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={10}
            className={INPUT}
          />
        </Field>
        <Field label="Address" basis={320}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Address"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
      </FieldRow>
      <PartyTypeField ownerId={customer.owner_id} value={partyTypeId} onChange={setPartyTypeId} />
      <FormActions onCancel={() => setEditing(false)} onSave={handleSave} saving={saving} />
    </PopupCard>
  ) : null;

  const typeName = customer.party_type_id ? partyTypeName.get(customer.party_type_id) : undefined;
  return (
    <>
    <View
      className="flex-row flex-wrap items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5"
      style={{ columnGap: 22, rowGap: 8 }}
    >
      <View style={{ flex: 1, minWidth: 200 }}>
        <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
          <Text className="text-[17px] font-extrabold text-gray-900">{nameCaps(customer.name)}</Text>
          {!!typeName && <PartyTypePill name={typeName} />}
        </View>
        {(!!customer.phone || !!customer.address) && (
          <View className="mt-0.5 flex-row flex-wrap" style={{ columnGap: 16, rowGap: 2 }}>
            {!!customer.phone && (
              <Pressable onPress={() => Linking.openURL(`tel:${customer.phone}`)} className="flex-row items-center gap-1">
                <Ionicons name="call-outline" size={12} color="#6B7280" />
                <Text className="text-[12.5px] text-blue-700">{customer.phone}</Text>
              </Pressable>
            )}
            {!!customer.address && (
              <Pressable
                onPress={() =>
                  customer.latitude != null && customer.longitude != null
                    ? Linking.openURL(`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`)
                    : undefined
                }
                className="flex-row items-center gap-1"
              >
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text className="text-[12.5px] text-gray-600">{customer.address}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {!!summary && (
        <View className="flex-row flex-wrap" style={{ columnGap: 22, rowGap: 6 }}>
          {summary}
        </View>
      )}
      <View className="flex-row" style={{ gap: 6 }}>
        <HeaderButton icon="pencil-outline" label="Edit" onPress={startEditing} />
        <HeaderButton icon="trash-outline" label="Delete" danger onPress={handleDelete} />
      </View>
    </View>
    {editPopup}
    </>
  );
}

/** The payment-method button the entry forms share: Cash or a bank account. */
function PaymentMethodButton({ name, isBank, onPress }: { name: string; isBank: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5"
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name={isBank ? 'business-outline' : 'cash-outline'} size={16} color="#6B7280" />
        <Text className="text-sm text-gray-900">{name}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
    </Pressable>
  );
}

function AddEntryForm({
  customerId,
  ownerId,
  initial,
  onDone,
}: {
  customerId: string;
  ownerId: string;
  initial?: CustomerLedgerEntry | null;
  onDone: () => void;
}) {
  const insertEntry = useSupabaseInsert('customer_ledger_entries');
  const updateEntry = useSupabaseUpdate('customer_ledger_entries');
  const bankAccounts = useBankAccounts(ownerId);
  const [entryType, setEntryType] = useState<LedgerEntryType>(initial?.entry_type ?? 'credit');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [bankAccountId, setBankAccountId] = useState<string | null>(initial?.bank_account_id ?? null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedAccountName = bankAccountId
    ? bankAccounts.accounts.find((a) => a.id === bankAccountId)?.name ?? 'Cash'
    : 'Cash';

  async function handleSave() {
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await updateEntry.mutateAsync({
          id: initial.id,
          values: { entry_type: entryType, amount: value, note: note.trim() || null, bank_account_id: bankAccountId },
        });
      } else {
        await insertEntry.mutateAsync({
          customer_id: customerId,
          owner_id: ownerId,
          entry_type: entryType,
          amount: value,
          note: note.trim() || null,
          source: 'manual',
          bank_account_id: bankAccountId,
        });
      }
      onDone();
    } catch (err) {
      showAlert('Could not save entry', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormCard icon="document-text-outline" title={initial ? 'Edit ledger entry' : 'Add ledger entry'}>
      <Segmented
        value={entryType}
        onChange={setEntryType}
        options={[
          { key: 'credit', label: 'Received', ...IN_TONE },
          { key: 'debit', label: 'Customer owes', ...OUT_TONE },
        ]}
      />
      <FieldRow>
        <Field label="Amount (NPR)" basis={160}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className={INPUT}
          />
        </Field>
        {entryType === 'credit' && (
          <Field label="Payment method" basis={200}>
            <PaymentMethodButton name={selectedAccountName} isBank={!!bankAccountId} onPress={() => setShowAccountPicker(true)} />
          </Field>
        )}
        <Field label="Remarks" basis={260}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
      </FieldRow>
      <FormActions onCancel={onDone} onSave={handleSave} saving={saving} saveLabel={initial ? 'Save' : 'Add entry'} />
      <BankAccountPickerModal
        visible={showAccountPicker}
        accounts={bankAccounts.accounts}
        selectedId={bankAccountId}
        onSelect={setBankAccountId}
        onClose={() => setShowAccountPicker(false)}
        onRename={bankAccounts.rename}
        onDelete={bankAccounts.remove}
      />
    </FormCard>
  );
}

/** The next Payment In receipt number (001, 002, ...), worked out the way the
 * Payment In screen does it: one past the highest number already used by a
 * manual payment received, falling back to how many there are when none of
 * them carry a number. */
async function nextReceivedReceiptNo(ownerId: string): Promise<string> {
  const rows = await fetchAllRows<{ receipt_no: string | null }>(
    (from, to) =>
      (supabase.from('customer_ledger_entries') as any)
        .select('receipt_no', { count: 'exact' })
        .eq('owner_id', ownerId)
        .eq('entry_type', 'credit')
        .eq('source', 'manual')
        .order('id')
        .range(from, to)
  );
  const numbers = rows.map((r) => Number((r.receipt_no ?? '').replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  return String((numbers.length ? Math.max(...numbers) : rows.length) + 1).padStart(3, '0');
}

/** The vendor-payable side: "You paid" (credit - settles part of what you owe
 * this vendor). Credit purchases are logged automatically from the Purchase
 * form, so there is no "Bought on credit" choice here any more - it only
 * shows for an existing entry that already is one, so that stays editable.
 *
 * "Received" fixes an entry logged on the wrong ledger (e.g. a customer's
 * payment recorded as Payment Out): the two ledgers are separate tables, so
 * saving it as Received moves the entry onto the customer ledger. */
function AddVendorEntryForm({
  vendorId,
  ownerId,
  initial,
  onDone,
}: {
  vendorId: string;
  ownerId: string;
  initial?: VendorLedgerEntry | null;
  onDone: () => void;
}) {
  const insertEntry = useSupabaseInsert('vendor_ledger_entries');
  const updateEntry = useSupabaseUpdate('vendor_ledger_entries');
  const deleteVendorEntry = useSupabaseDelete('vendor_ledger_entries');
  const insertCustomerEntry = useSupabaseInsert('customer_ledger_entries');
  const deleteCustomerEntry = useSupabaseDelete('customer_ledger_entries');
  const bankAccounts = useBankAccounts(ownerId);
  // paid = vendor-ledger credit, received = customer-ledger credit, onCredit =
  // vendor-ledger debit (only ever an existing entry being edited).
  const [kind, setKind] = useState<'paid' | 'received' | 'onCredit'>(initial?.entry_type === 'debit' ? 'onCredit' : 'paid');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [bankAccountId, setBankAccountId] = useState<string | null>(initial?.bank_account_id ?? null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedAccountName = bankAccountId
    ? bankAccounts.accounts.find((a) => a.id === bankAccountId)?.name ?? 'Cash'
    : 'Cash';

  /** Records a payment received from this party on the customer ledger. When
   * it came from an existing vendor entry, that entry is removed afterwards; if
   * the removal fails the new one is taken back out, so the money is never
   * counted on both ledgers at once. */
  async function recordReceived(entry: VendorLedgerEntry | null, value: number) {
    const created = await insertCustomerEntry.mutateAsync({
      customer_id: vendorId,
      owner_id: ownerId,
      entry_type: 'credit',
      amount: value,
      note: note.trim() || null,
      source: 'manual',
      bank_account_id: bankAccountId,
      ...(entry ? { entry_date: entry.entry_date ?? entry.created_at.slice(0, 10) } : {}),
      receipt_no: await nextReceivedReceiptNo(ownerId),
    });
    if (!entry) return;
    try {
      await deleteVendorEntry.mutateAsync(entry.id);
    } catch (err) {
      await deleteCustomerEntry.mutateAsync(created.id).catch(() => {});
      throw err;
    }
  }

  async function handleSave() {
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      if (kind === 'received') {
        await recordReceived(initial ?? null, value);
        if (initial) {
          showAlert('Moved to Received', `NPR ${value.toLocaleString()} is now a Received entry on the customer ledger.`);
        }
      } else if (initial) {
        await updateEntry.mutateAsync({
          id: initial.id,
          values: { entry_type: kind === 'paid' ? 'credit' : 'debit', amount: value, note: note.trim() || null, bank_account_id: bankAccountId },
        });
      } else {
        await insertEntry.mutateAsync({
          vendor_id: vendorId,
          owner_id: ownerId,
          entry_type: 'credit',
          amount: value,
          note: note.trim() || null,
          source: 'manual',
          bank_account_id: bankAccountId,
        });
      }
      onDone();
    } catch (err) {
      showAlert('Could not save entry', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormCard icon="cart-outline" title={initial ? 'Edit vendor entry' : 'Add vendor entry'}>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { key: 'paid', label: 'Payment Out', ...OUT_TONE },
          { key: 'received', label: 'Received', ...IN_TONE },
          ...(initial?.entry_type === 'debit' ? [{ key: 'onCredit' as const, label: 'Bought on credit', ...OUT_TONE }] : []),
        ]}
      />
      <FieldRow>
        <Field label="Amount (NPR)" basis={160}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className={INPUT}
          />
        </Field>
        {kind !== 'onCredit' && (
          <Field label="Payment method" basis={200}>
            <PaymentMethodButton name={selectedAccountName} isBank={!!bankAccountId} onPress={() => setShowAccountPicker(true)} />
          </Field>
        )}
        <Field label="Remarks" basis={260}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
      </FieldRow>
      <FormActions onCancel={onDone} onSave={handleSave} saving={saving} saveLabel={initial ? 'Save' : 'Add entry'} />
      <BankAccountPickerModal
        visible={showAccountPicker}
        accounts={bankAccounts.accounts}
        selectedId={bankAccountId}
        onSelect={setBankAccountId}
        onClose={() => setShowAccountPicker(false)}
        onRename={bankAccounts.rename}
        onDelete={bankAccounts.remove}
      />
    </FormCard>
  );
}

/** One line of the history, whichever list it came from - a customer ledger
 * entry, a vendor ledger entry or a bill - so the table and the phone cards
 * draw from the same thing. */
type HistoryRow = {
  key: string;
  /** What the line is: Received, Payment Out, Sale bill ... */
  label: string;
  tone: { color: string; bg: string };
  /** The note, with its receipt / bill number in front. */
  detail: string;
  dateLabel: string;
  amount: number;
  amountColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  /** A manual entry can be edited and removed here; the rest are read-only. */
  manual: boolean;
  ledger?: CustomerLedgerEntry;
  vendor?: VendorLedgerEntry;
  tx?: BusinessTransaction;
};

export function CustomerDetailScreen({ basePath }: { basePath: string }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Hidden tab screens stay mounted between visits, so opening another
  // record reused this one's component state (typed quote/remark/price, a
  // "thanks for rating" flag, an open edit form...). Keying on the id gives
  // every record its own fresh state.
  return <CustomerDetail key={id} id={id} basePath={basePath} />;
}

function CustomerDetail({ id, basePath }: { id: string; basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  // `all` on both ledger reads: the balance is a sum over every entry.
  const { data: entries } = useSupabaseQuery('customer_ledger_entries', {
    filters: { customer_id: id },
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!id,
  });
  // Sales/purchases billed directly to this saved customer/vendor. Each one
  // automatically books a matching debt on the ledger below (see
  // 0061_sale_purchase_always_ledger.sql) - the bill itself is shown here
  // instead of that auto-synced ledger entry (history filters those out),
  // since the bill carries the real detail (items, bill no.) the ledger
  // entry doesn't.
  const { data: linkedTransactions } = useSupabaseQuery('business_transactions', {
    filters: { customer_id: id },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!id,
  });
  // The payable side of this same party - only ever non-empty for someone
  // who's also been picked as a Vendor on a credit Purchase, or who's had a
  // payment logged against them below. Kept separate from `entries` above
  // (opposite polarity: a vendor's debit is a debt owed BY the business).
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: { vendor_id: id },
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!id,
  });
  const deleteEntry = useSupabaseDelete('customer_ledger_entries');
  const deleteVendorEntry = useSupabaseDelete('vendor_ledger_entries');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddVendorEntry, setShowAddVendorEntry] = useState(false);
  // Tapping a manual entry in History reopens the same form pre-filled,
  // instead of only ever letting one be added and never fixed - a wrong
  // amount or note previously meant delete-and-redo.
  const [editingEntry, setEditingEntry] = useState<CustomerLedgerEntry | null>(null);
  const [editingVendorEntry, setEditingVendorEntry] = useState<VendorLedgerEntry | null>(null);
  // Tapping a linked bill in History opens the same organized detail view
  // Transactions uses, instead of duplicating that layout here.
  const [viewingTx, setViewingTx] = useState<BusinessTransaction | null>(null);

  const layout = useBookLayout();
  // On the web table an entry being edited opens right under its own row; on a
  // phone (a card list) its form stays at the top of the page.
  const inline = Platform.OS === 'web';

  const balance = useMemo(() => {
    return (entries ?? []).reduce((sum, e) => sum + (e.entry_type === 'debit' ? e.amount : -e.amount), 0);
  }, [entries]);

  // A party that already has vendor history but has never been used as a
  // customer is being treated purely as a vendor here (e.g. opened from the
  // To pay tile) - the customer-side balance and "Add entry" are just noise
  // on that page. A brand-new party with neither yet still sees both, so
  // there's always a way to log its first entry. Same logic in reverse for a
  // party that's only ever been a customer - the vendor tile and "Payment
  // Out" button are just as much noise there.
  const isPureVendor = (vendorEntries?.length ?? 0) > 0 && (entries?.length ?? 0) === 0;
  const isPureCustomer = (entries?.length ?? 0) > 0 && (vendorEntries?.length ?? 0) === 0;

  const vendorBalance = useMemo(() => {
    return (vendorEntries ?? []).reduce((sum, e) => sum + (e.entry_type === 'debit' ? e.amount : -e.amount), 0);
  }, [vendorEntries]);

  const history = useMemo(() => {
    // Entries auto-synced from a Sale/Purchase's own ledger debt (see
    // 0061_sale_purchase_always_ledger.sql) are skipped here - the linked
    // bill below already represents them, so this only counts toward
    // balance/vendorBalance above, not shown a second time.
    const isAutoSyncedFromBill = (source: string, sourceType: string | null) => source === 'booking' && sourceType === 'business_transaction';
    const ledgerItems = (entries ?? [])
      .filter((e) => !isAutoSyncedFromBill(e.source, e.source_type))
      .map((e) => ({ kind: 'ledger' as const, id: e.id, date: e.created_at, entry: e }));
    const vendorItems = (vendorEntries ?? [])
      .filter((e) => !isAutoSyncedFromBill(e.source, e.source_type))
      .map((e) => ({ kind: 'vendor' as const, id: e.id, date: e.created_at, entry: e }));
    const txItems = (linkedTransactions ?? []).map((t) => ({ kind: 'tx' as const, id: t.id, date: t.created_at, tx: t }));
    return [...ledgerItems, ...vendorItems, ...txItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, vendorEntries, linkedTransactions]);

  const rows = useMemo<HistoryRow[]>(
    () =>
      history.map((item): HistoryRow => {
        if (item.kind === 'tx') {
          const t = item.tx;
          const isSale = t.type === 'sale';
          return {
            key: `tx-${t.id}`,
            label: TX_TYPE_LABEL[t.type],
            tone: isSale ? IN_TONE : OUT_TONE,
            detail: [t.bill_no ? `Bill No. ${t.bill_no}` : null, t.note].filter(Boolean).join(' · '),
            dateLabel: toBsHistoryLabel(t.bill_date ?? t.created_at),
            amount: t.amount,
            amountColor: isSale ? '#059669' : '#DC2626',
            icon: 'receipt-outline',
            iconColor: isSale ? '#059669' : '#DC2626',
            iconBg: isSale ? '#ECFDF5' : '#FEF2F2',
            manual: false,
            tx: t,
          };
        }
        if (item.kind === 'vendor') {
          const e = item.entry;
          const onCredit = e.entry_type === 'debit';
          return {
            key: `vendor-${e.id}`,
            label: onCredit ? 'Bought on credit' : 'Payment Out',
            tone: OUT_TONE,
            detail: [
              e.receipt_no ? `Payment No. ${e.receipt_no}` : null,
              e.note ?? (e.source === 'booking' ? 'From a credit purchase' : 'Manual entry'),
            ]
              .filter(Boolean)
              .join(' · '),
            dateLabel: toBsHistoryLabel(e.entry_date ?? e.created_at),
            amount: e.amount,
            amountColor: '#DC2626',
            icon: onCredit ? 'cart-outline' : 'arrow-up',
            iconColor: '#DC2626',
            iconBg: '#FEF2F2',
            manual: e.source === 'manual',
            vendor: e,
          };
        }
        const e = item.entry;
        const owes = e.entry_type === 'debit';
        const outgoing = owes && e.source === 'manual';
        return {
          key: `ledger-${e.id}`,
          label: owes ? 'Owes' : 'Received',
          tone: owes ? NEUTRAL_TONE : IN_TONE,
          detail: [
            e.receipt_no ? `${owes ? 'Payment' : 'Receipt'} No. ${e.receipt_no}` : null,
            e.note ?? (e.source === 'booking' ? 'From a booked job' : 'Manual entry'),
          ]
            .filter(Boolean)
            .join(' · '),
          dateLabel: toBsHistoryLabel(e.entry_date ?? e.created_at),
          amount: e.amount,
          amountColor: outgoing ? '#DC2626' : '#059669',
          icon: owes ? 'arrow-up' : 'arrow-down',
          iconColor: outgoing ? '#DC2626' : '#059669',
          iconBg: outgoing ? '#FEF2F2' : '#ECFDF5',
          manual: e.source === 'manual',
          ledger: e,
        };
      }),
    [history]
  );

  function openRow(row: HistoryRow) {
    if (row.tx) {
      setViewingTx(row.tx);
    } else if (row.vendor && row.manual) {
      setEditingVendorEntry(row.vendor);
      setShowAddVendorEntry(true);
    } else if (row.ledger && row.manual) {
      setEditingEntry(row.ledger);
      setShowAddEntry(true);
    }
  }

  function removeRow(row: HistoryRow) {
    showAlert('Remove this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (row.vendor) deleteVendorEntry.mutate(row.vendor.id);
          else if (row.ledger) deleteEntry.mutate(row.ledger.id);
        },
      },
    ]);
  }

  // Back to wherever this person was opened from - the Ledger, a To receive list,
  // the Day Book... - and to the Ledger when there is nothing to go back to (the
  // page was opened directly). The sidebar is no longer the only way out.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`${basePath}/customers` as any);
  };

  // The Back button, "Add entry" and "Payment Out" live in the top bar on a wide
  // screen; the two actions drop to a plain row at the top of the page on a narrow one.
  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      left: () => <BackButton onPress={goBack} />,
      right: () => (
        <>
          {!isPureVendor && !showAddEntry && (
            <ToolbarButton
              icon="add"
              label="Add entry"
              onPress={() => {
                setEditingEntry(null);
                setShowAddEntry(true);
              }}
            />
          )}
          {!isPureCustomer && !showAddVendorEntry && (
            <ToolbarButton
              icon="arrow-up-circle-outline"
              label="Payment Out"
              onPress={() => {
                setEditingVendorEntry(null);
                setShowAddVendorEntry(true);
              }}
            />
          )}
        </>
      ),
    },
    [isPureVendor, isPureCustomer, showAddEntry, showAddVendorEntry, basePath]
  );

  if (!id || !userId) return null;

  const editingHere = (row: HistoryRow) =>
    (!!row.ledger && row.ledger.id === editingEntry?.id) || (!!row.vendor && row.vendor.id === editingVendorEntry?.id);

  const removeButton = (row: HistoryRow) => (
    <Pressable onPress={() => removeRow(row)} hitSlop={8} accessibilityLabel="Remove entry">
      <Ionicons name="close" size={16} color="#9CA3AF" />
    </Pressable>
  );

  // --- History: a bordered table on the web, flat cards on a phone ---
  const detailsCell = (row: HistoryRow, withDate: boolean) => (
    <View style={{ minWidth: 0 }}>
      <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
        {row.detail || row.label}
      </Text>
      {withDate && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          {row.dateLabel}
        </Text>
      )}
    </View>
  );
  const typeColumn: BookColumn<HistoryRow> = {
    key: 'type',
    label: 'Type',
    width: 130,
    render: (row) => <Pill text={row.label} color={row.tone.color} bg={row.tone.bg} />,
  };
  const amountColumn: BookColumn<HistoryRow> = {
    key: 'amount',
    label: 'Amount (NPR)',
    width: 140,
    align: 'right',
    render: (row) => (
      <Text className="text-[13px] font-bold" style={{ color: row.amountColor }}>
        {row.amount.toLocaleString()}
      </Text>
    ),
  };
  const actionColumn: BookColumn<HistoryRow> = {
    key: 'action',
    label: '',
    width: 44,
    align: 'right',
    render: (row) => (row.tx ? <Ionicons name="chevron-forward" size={14} color="#D1D5DB" /> : row.manual ? removeButton(row) : null),
  };
  const columns: BookColumn<HistoryRow>[] = layout.full
    ? [
        { key: 'date', label: 'Date', width: 130, render: (row) => <Text className="text-[12.5px] text-gray-600">{row.dateLabel}</Text> },
        { key: 'details', label: 'Details', render: (row) => detailsCell(row, false) },
        typeColumn,
        amountColumn,
        actionColumn,
      ]
    : [{ key: 'details', label: 'Details', render: (row) => detailsCell(row, true) }, typeColumn, amountColumn, actionColumn];

  const historyView =
    rows.length === 0 ? (
      <View className="items-center rounded-xl border border-gray-300 bg-white py-8">
        <Ionicons name="document-text-outline" size={26} color="#D1D5DB" />
        <Text className="mt-2 text-sm text-gray-500">No history yet.</Text>
      </View>
    ) : Platform.OS === 'web' ? (
      <BookTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        onRowPress={openRow}
        highlight={editingHere}
        expanded={(row) => {
          if (row.ledger && row.ledger.id === editingEntry?.id && showAddEntry) {
            return (
              <View className="border-b border-gray-200 bg-gray-50 p-3">
                <AddEntryForm
                  key={row.ledger.id}
                  customerId={id}
                  ownerId={userId}
                  initial={editingEntry}
                  onDone={() => {
                    setShowAddEntry(false);
                    setEditingEntry(null);
                  }}
                />
              </View>
            );
          }
          if (row.vendor && row.vendor.id === editingVendorEntry?.id && showAddVendorEntry) {
            return (
              <View className="border-b border-gray-200 bg-gray-50 p-3">
                <AddVendorEntryForm
                  key={row.vendor.id}
                  vendorId={id}
                  ownerId={userId}
                  initial={editingVendorEntry}
                  onDone={() => {
                    setShowAddVendorEntry(false);
                    setEditingVendorEntry(null);
                  }}
                />
              </View>
            );
          }
          return null;
        }}
      />
    ) : (
      <View>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            disabled={!row.tx && !row.manual}
            onPress={() => openRow(row)}
            className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: row.iconBg }}>
              <Ionicons name={row.icon} size={14} color={row.iconColor} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">{row.label}</Text>
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {row.detail ? `${row.detail} · ` : ''}
                {row.dateLabel}
              </Text>
            </View>
            <Text className="text-sm font-extrabold" style={{ color: row.amountColor }}>
              NPR {row.amount.toLocaleString()}
            </Text>
            {row.tx ? <Ionicons name="chevron-forward" size={14} color="#D1D5DB" style={{ marginLeft: 6 }} /> : row.manual ? removeButton(row) : null}
          </Pressable>
        ))}
      </View>
    );

  // The balances, shown in the name card itself rather than a row of their own.
  // Worded the way the Ledger words them: "To receive" is money coming to you,
  // "To pay" is money you owe - and the caption says which way round it is.
  const customerWords =
    balance > 0
      ? { label: 'To receive', caption: 'Customer owes you', color: MONEY.in.text }
      : balance < 0
        ? { label: 'To pay', caption: 'You owe the customer', color: MONEY.out.text }
        : { label: 'Balance', caption: undefined, color: '#374151' };
  const vendorWords =
    vendorBalance > 0
      ? { label: 'To pay', caption: 'You owe the vendor', color: MONEY.out.text }
      : vendorBalance < 0
        ? { label: 'To receive', caption: 'You overpaid the vendor', color: MONEY.in.text }
        : { label: 'Vendor balance', caption: undefined, color: '#374151' };
  const summary = (
    <>
      {!isPureVendor && (
        <BalanceFigure
          label={customerWords.label}
          caption={customerWords.caption}
          value={`NPR ${Math.abs(balance).toLocaleString()}`}
          color={customerWords.color}
        />
      )}
      {(vendorEntries?.length ?? 0) > 0 && (
        <BalanceFigure
          label={vendorWords.label}
          caption={vendorWords.caption}
          value={`NPR ${Math.abs(vendorBalance).toLocaleString()}`}
          color={vendorWords.color}
        />
      )}
    </>
  );

  // A form for a brand-new entry opens at the top; one for an existing entry
  // opens under its row on the web (see `expanded` above), at the top on a phone.
  const addFormOpen = showAddEntry && !(inline && editingEntry);
  const addVendorFormOpen = showAddVendorEntry && !(inline && editingVendorEntry);

  return (
    <>
      <KeyboardAwareScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: layout.wide ? 24 : 12, paddingBottom: 48, gap: 14 }}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        {toolbar}

        <EditableDetails customerId={id} basePath={basePath} summary={summary} />

        {!isPureVendor && addFormOpen && (
          <AddEntryForm
            customerId={id}
            ownerId={userId}
            initial={editingEntry}
            onDone={() => {
              setShowAddEntry(false);
              setEditingEntry(null);
            }}
          />
        )}
        {!isPureCustomer && addVendorFormOpen && (
          <AddVendorEntryForm
            vendorId={id}
            ownerId={userId}
            initial={editingVendorEntry}
            onDone={() => {
              setShowAddVendorEntry(false);
              setEditingVendorEntry(null);
            }}
          />
        )}

        <Text className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">History</Text>
        {historyView}
      </KeyboardAwareScrollView>
      <TransactionDetailModal
        tx={viewingTx}
        categoryName={null}
        bankAccountName={null}
        onClose={() => setViewingTx(null)}
        onEdit={() => {
          if (viewingTx) router.push(`${basePath}/transactions?type=${viewingTx.type}&add=1&edit=${viewingTx.id}` as any);
          setViewingTx(null);
        }}
      />
    </>
  );
}
