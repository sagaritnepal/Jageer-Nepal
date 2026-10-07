// lib/components/finance/CustomerDetailScreen.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, Linking, useWindowDimensions } from 'react-native';
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
import { PartyTypeField } from './PartyTypeField';
import { TransactionDetailModal } from './TransactionsScreen';
import { BackButton, BookTable, Pill, ToolbarButton, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { OptionMenuModal } from './ledger/LedgerUi';
import { Field, FieldRow, FormActions, FormCard, INPUT, PopupCard, Segmented } from './FormKit';
import { MONEY } from './moneyColors';
import { supabase } from '../../supabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { nameCaps } from '../../utils/nameCaps';
import { deleteErrorMessage } from '../../utils/dbErrors';
import { fetchAllRows } from '../../utils/fetchAllRows';
import { isValidPhone10 } from '../../utils/phone';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import { localTodayIso } from '../../utils/localDate';
import {
  compareItems,
  drCr,
  entryDay,
  sideTotals,
  summarize,
  withRunningBalance,
  type LedgerItem,
} from '../../utils/ledgerStatement';
import { drCrText, exportStatementXlsx, printStatement, type StatementData } from '../../utils/exportLedger';
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

/** The balance in the name card: "To receive" or "To pay" over the coloured amount. */
function BalanceFigure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Text className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400" numberOfLines={1}>
        {label}
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
  // A ledger type is required - unless there are none to choose from (the types table
  // is not set up yet), where the field is not shown at all.
  const { available: typesAvailable } = usePartyTypes(customer?.owner_id);

  if (!customer) return null;

  function startEditing() {
    setName(nameCaps(customer!.name));
    setPhone(customer!.phone ?? '');
    setAddress(customer!.address ?? '');
    setPartyTypeId(customer!.party_type_id ?? null);
    setEditing(true);
  }

  async function handleSave() {
    // The name and the ledger type are required; the phone number and address are not.
    const missing = [!name.trim() && 'Name', typesAvailable && !partyTypeId && 'Ledger type'].filter(Boolean);
    if (missing.length > 0) {
      showAlert('Fill in the required details', `Still needed: ${missing.join(', ')}.`);
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
        <Field label="Name *" basis={240}>
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
      <PartyTypeField ownerId={customer.owner_id} value={partyTypeId} onChange={setPartyTypeId} required />
      <Text className="text-[11px] text-gray-400">* Required</Text>
      <FormActions onCancel={() => setEditing(false)} onSave={handleSave} saving={saving} />
    </PopupCard>
  ) : null;

  return (
    <>
    <View
      className="flex-row flex-wrap items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5"
      style={{ columnGap: 22, rowGap: 8 }}
    >
      <View style={{ flex: 1, minWidth: 200 }}>
        <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
          <Text className="text-[17px] font-extrabold text-gray-900">{nameCaps(customer.name)}</Text>
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
  defaultType,
  onDone,
}: {
  customerId: string;
  ownerId: string;
  initial?: CustomerLedgerEntry | null;
  /** Which way a new entry starts: Received or Customer owes. */
  defaultType?: LedgerEntryType;
  onDone: () => void;
}) {
  const insertEntry = useSupabaseInsert('customer_ledger_entries');
  const updateEntry = useSupabaseUpdate('customer_ledger_entries');
  const bankAccounts = useBankAccounts(ownerId);
  const [entryType, setEntryType] = useState<LedgerEntryType>(initial?.entry_type ?? defaultType ?? 'credit');
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

  const accountPicker = (
    <BankAccountPickerModal
      visible={showAccountPicker}
      accounts={bankAccounts.accounts}
      selectedId={bankAccountId}
      onSelect={setBankAccountId}
      onClose={() => setShowAccountPicker(false)}
      onRename={bankAccounts.rename}
      onDelete={bankAccounts.remove}
    />
  );
  const typeOptions = [
    { key: 'credit' as const, label: 'Received', ...IN_TONE },
    { key: 'debit' as const, label: 'Customer owes', ...OUT_TONE },
  ];

  return (
    <FormCard icon="document-text-outline" title={initial ? 'Edit ledger entry' : 'Add ledger entry'}>
      <Segmented value={entryType} onChange={setEntryType} options={typeOptions} />
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
      {accountPicker}
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

  const accountPicker = (
    <BankAccountPickerModal
      visible={showAccountPicker}
      accounts={bankAccounts.accounts}
      selectedId={bankAccountId}
      onSelect={setBankAccountId}
      onClose={() => setShowAccountPicker(false)}
      onRename={bankAccounts.rename}
      onDelete={bankAccounts.remove}
    />
  );
  const kindOptions = [
    { key: 'paid' as const, label: 'Payment Out', ...OUT_TONE },
    { key: 'received' as const, label: 'Received', ...IN_TONE },
    ...(initial?.entry_type === 'debit' ? [{ key: 'onCredit' as const, label: 'Bought on credit', ...OUT_TONE }] : []),
  ];

  return (
    <FormCard icon="cart-outline" title={initial ? 'Edit vendor entry' : 'Add vendor entry'}>
      <Segmented value={kind} onChange={setKind} options={kindOptions} />
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
      {accountPicker}
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
  /** The note. */
  detail: string;
  /** Its receipt / bill number. */
  reference: string;
  dateLabel: string;
  /** 'YYYY-MM-DD', and when it was entered - what the statement is ordered by. */
  day: string;
  createdAt: string;
  /** The party's Debit / Credit for this line, and the balance after it. */
  debit: number;
  credit: number;
  balance: number;
  /** Listed for the record but not part of the balance (an Expense). */
  info?: boolean;
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
  // The statement table needs the room (the sidebar takes 240px of it): below
  // 1000px it is a card list, like on a phone.
  const { width: windowWidth } = useWindowDimensions();
  const tableMode = layout.wide && windowWidth >= 1000;
  // On the web table an entry being edited opens right under its own row; on a
  // phone (a card list) its form stays at the top of the page.
  const inline = tableMode;

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

  const { data: partyRow } = useSupabaseRow('customers', id);
  const profile = useAuthStore((state) => state.profile);
  const { nameById: partyTypeName } = usePartyTypes(partyRow?.owner_id);
  // Which way "Add entry" opens its form: Received (credit) or Customer owes (debit).
  const [entryPreset, setEntryPreset] = useState<LedgerEntryType>('credit');

  // ---- The statement: both ledgers as one account (see ledgerStatement.ts) ----
  const [exportMenu, setExportMenu] = useState(false);
  const today = localTodayIso();

  const items = useMemo<LedgerItem[]>(
    () => [
      ...(entries ?? []).map(
        (e): LedgerItem => ({
          id: e.id,
          side: 'customer',
          entryType: e.entry_type,
          amount: Number(e.amount),
          day: entryDay(e.entry_date, e.created_at),
          createdAt: e.created_at,
        })
      ),
      ...(vendorEntries ?? []).map(
        (e): LedgerItem => ({
          id: e.id,
          side: 'vendor',
          entryType: e.entry_type,
          amount: Number(e.amount),
          day: entryDay(e.entry_date, e.created_at),
          createdAt: e.created_at,
        })
      ),
    ],
    [entries, vendorEntries]
  );
  const totals = useMemo(() => summarize(items), [items]);
  const sides = useMemo(() => sideTotals(items), [items]);

  // Every line of the account, oldest first. A bill's own ledger entry (the one
  // a Sale / Purchase logs automatically - see 0061_sale_purchase_always_ledger.sql)
  // is shown as the bill, since the bill carries the real detail (bill no., items)
  // the entry doesn't; the amounts still come from the entry, so the running
  // balance always adds up to the same figure as the name card. A bill with no
  // entry behind it (an Expense) is listed too, but is not part of the balance.
  const allLines = useMemo<HistoryRow[]>(() => {
    const txById = new Map((linkedTransactions ?? []).map((t) => [t.id, t]));
    const billedTx = new Set<string>();
    const lines: HistoryRow[] = [];

    const billLine = (t: BusinessTransaction, amount: number, debit: number, credit: number, day: string, createdAt: string, info: boolean): HistoryRow => {
      const isSale = t.type === 'sale';
      return {
        key: `tx-${t.id}`,
        label: TX_TYPE_LABEL[t.type],
        tone: isSale ? IN_TONE : OUT_TONE,
        detail: t.note ?? '',
        reference: t.bill_no ?? '',
        dateLabel: toBsHistoryLabel(day),
        day,
        createdAt,
        debit,
        credit,
        balance: 0,
        info,
        amount,
        amountColor: isSale ? '#059669' : '#DC2626',
        icon: 'receipt-outline',
        iconColor: isSale ? '#059669' : '#DC2626',
        iconBg: isSale ? '#ECFDF5' : '#FEF2F2',
        manual: false,
        tx: t,
      };
    };

    for (const e of entries ?? []) {
      const { debit, credit } = drCr('customer', e.entry_type, e.amount);
      const day = entryDay(e.entry_date, e.created_at);
      const syncedFromBill = e.source === 'booking' && e.source_type === 'business_transaction';
      const tx = syncedFromBill && e.source_id ? txById.get(e.source_id) : undefined;
      if (tx) {
        billedTx.add(tx.id);
        lines.push(billLine(tx, e.amount, debit, credit, day, e.created_at, false));
        continue;
      }
      const owes = e.entry_type === 'debit';
      const outgoing = owes && e.source === 'manual';
      lines.push({
        key: `ledger-${e.id}`,
        label: syncedFromBill ? TX_TYPE_LABEL.sale : owes ? 'Owes' : 'Received',
        tone: owes ? (syncedFromBill ? IN_TONE : NEUTRAL_TONE) : IN_TONE,
        detail: e.note ?? (syncedFromBill ? '' : e.source === 'booking' ? 'From a booked job' : 'Manual entry'),
        reference: e.receipt_no ?? '',
        dateLabel: toBsHistoryLabel(day),
        day,
        createdAt: e.created_at,
        debit,
        credit,
        balance: 0,
        amount: e.amount,
        amountColor: outgoing ? '#DC2626' : '#059669',
        icon: owes ? 'arrow-up' : 'arrow-down',
        iconColor: outgoing ? '#DC2626' : '#059669',
        iconBg: outgoing ? '#FEF2F2' : '#ECFDF5',
        manual: e.source === 'manual',
        ledger: e,
      });
    }

    for (const e of vendorEntries ?? []) {
      const { debit, credit } = drCr('vendor', e.entry_type, e.amount);
      const day = entryDay(e.entry_date, e.created_at);
      const syncedFromBill = e.source === 'booking' && e.source_type === 'business_transaction';
      const tx = syncedFromBill && e.source_id ? txById.get(e.source_id) : undefined;
      if (tx) {
        billedTx.add(tx.id);
        lines.push(billLine(tx, e.amount, debit, credit, day, e.created_at, false));
        continue;
      }
      const onCredit = e.entry_type === 'debit';
      lines.push({
        key: `vendor-${e.id}`,
        label: onCredit ? (syncedFromBill ? TX_TYPE_LABEL.purchase : 'Bought on credit') : 'Payment Out',
        tone: OUT_TONE,
        detail: e.note ?? (syncedFromBill ? '' : e.source === 'booking' ? 'From a credit purchase' : 'Manual entry'),
        reference: e.receipt_no ?? '',
        dateLabel: toBsHistoryLabel(day),
        day,
        createdAt: e.created_at,
        debit,
        credit,
        balance: 0,
        amount: e.amount,
        amountColor: '#DC2626',
        icon: onCredit ? 'cart-outline' : 'arrow-up',
        iconColor: '#DC2626',
        iconBg: '#FEF2F2',
        manual: e.source === 'manual',
        vendor: e,
      });
    }

    for (const t of linkedTransactions ?? []) {
      if (billedTx.has(t.id)) continue;
      lines.push(billLine(t, t.amount, 0, 0, entryDay(t.bill_date, t.created_at), t.created_at, true));
    }
    return lines.sort(compareItems);
  }, [entries, vendorEntries, linkedTransactions]);

  // Every line with the running balance after it, oldest first - and shown newest first.
  const statementAsc = useMemo<HistoryRow[]>(() => withRunningBalance(allLines, 0), [allLines]);
  const rows = useMemo(() => [...statementAsc].reverse(), [statementAsc]);

  // Only one entry form is open at a time: a person with no entries yet is offered both
  // (Add Entry for the customer side, Payment Out for the vendor side), and opening one
  // closes the other rather than stacking two forms.
  function closeCustomerForm() {
    setShowAddEntry(false);
    setEditingEntry(null);
  }
  function closeVendorForm() {
    setShowAddVendorEntry(false);
    setEditingVendorEntry(null);
  }

  function openRow(row: HistoryRow) {
    if (row.tx) {
      setViewingTx(row.tx);
    } else if (row.vendor && row.manual) {
      closeCustomerForm();
      setEditingVendorEntry(row.vendor);
      setShowAddVendorEntry(true);
    } else if (row.ledger && row.manual) {
      closeVendorForm();
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

  // What this party can have: a vendor-only party has no customer side and the
  // other way round (see isPureVendor above); a new one has both until its first entry.
  const showCustomer = !isPureVendor;
  const showVendor = !isPureCustomer;

  function openCustomerForm(type: LedgerEntryType) {
    closeVendorForm();
    setEditingEntry(null);
    setEntryPreset(type);
    setShowAddEntry(true);
  }
  function openVendorForm() {
    closeCustomerForm();
    setEditingVendorEntry(null);
    setShowAddVendorEntry(true);
  }

  // Payment Out, New Sale, Add Entry, Print / Download - a row of their own under
  // the name card (there are too many for the top bar on most screens). Payment Out
  // is what the rest of the app calls paying someone; a payment received from a
  // customer is an Add Entry, which opens on Received.
  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      inBarMinWidth: 1500,
      left: () => <BackButton onPress={goBack} />,
      right: () => (
        <>
          {showVendor && <ToolbarButton icon="arrow-up-circle-outline" label="Payment Out" onPress={openVendorForm} />}
          {showCustomer && (
            <HeaderButton
              icon="receipt-outline"
              label="New Sale"
              onPress={() => router.push(`${basePath}/transactions?type=sale&add=1&partyId=${id}` as any)}
            />
          )}
          {showCustomer && <HeaderButton icon="add" label="Add Entry" onPress={() => openCustomerForm('credit')} />}
          <HeaderButton icon="print-outline" label="Print / Download" onPress={() => setExportMenu(true)} />
        </>
      ),
    },
    [isPureVendor, isPureCustomer, basePath, id]
  );

  // The statement as the print / Excel export draws it: oldest first, without the
  // lines that are not in the balance.
  async function runExport(kind: 'print' | 'excel') {
    setExportMenu(false);
    if (!partyRow) return;
    const closingWords = totals.closing > 0.5 ? 'To receive' : totals.closing < -0.5 ? 'To pay' : 'Settled';
    const data: StatementData = {
      businessName: profile?.business_name ?? profile?.full_name ?? '',
      partyName: nameCaps(partyRow.name),
      phone: partyRow.phone ?? '',
      address: partyRow.address ?? '',
      ledgerType: partyRow.party_type_id ? partyTypeName.get(partyRow.party_type_id) ?? '' : '',
      periodLabel: 'All dates',
      printedOn: toBsHistoryLabel(today),
      opening: totals.opening,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
      closing: totals.closing,
      summary: [
        ...(totals.hasCustomer ? [{ label: 'Total sales', value: `NPR ${Math.round(sides.billed).toLocaleString()}` }, { label: 'Total payments', value: `NPR ${Math.round(sides.received).toLocaleString()}` }] : []),
        ...(totals.hasVendor ? [{ label: 'Total purchases', value: `NPR ${Math.round(sides.purchased).toLocaleString()}` }, { label: 'Paid out', value: `NPR ${Math.round(sides.paid).toLocaleString()}` }] : []),
        { label: 'Outstanding balance', value: `${drCrText(totals.closing)} · ${closingWords}` },
      ],
      lines: statementAsc
        .filter((l) => !l.info)
        .map((l) => ({
          dateLabel: l.dateLabel,
          adDate: l.day,
          description: [l.label, l.detail].filter(Boolean).join(' - '),
          reference: l.reference,
          debit: l.debit,
          credit: l.credit,
          balance: l.balance,
        })),
    };
    try {
      if (kind === 'print') await printStatement(data);
      else await exportStatementXlsx(data);
    } catch (err) {
      showAlert('Could not export the statement', getErrorMessage(err));
    }
  }

  if (!id || !userId) return null;

  const editingHere = (row: HistoryRow) =>
    (!!row.ledger && row.ledger.id === editingEntry?.id) || (!!row.vendor && row.vendor.id === editingVendorEntry?.id);

  const removeButton = (row: HistoryRow) => (
    <Pressable onPress={() => removeRow(row)} hitSlop={8} accessibilityLabel="Remove entry">
      <Ionicons name="close" size={16} color="#9CA3AF" />
    </Pressable>
  );

  // --- History: a bordered table on the web, flat cards on a phone ---
  // What a line says under "Details": its receipt / bill number, then the note.
  const detailText = (row: HistoryRow) => {
    const kind = row.tx ? 'Bill' : row.vendor || row.ledger?.entry_type === 'debit' ? 'Payment' : 'Receipt';
    return [row.reference ? `${kind} No. ${row.reference}` : null, row.detail].filter(Boolean).join(' · ');
  };
  const detailsCell = (row: HistoryRow, withDate: boolean) => (
    <View style={{ minWidth: 0 }}>
      <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
        {detailText(row) || row.label}
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
  const columns: BookColumn<HistoryRow>[] =
    windowWidth >= 1280
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
    ) : tableMode ? (
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
                {detailText(row) ? `${detailText(row)} · ` : ''}
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

  // The balance, shown in the name card itself rather than a row of their own: one figure,
  // both of their ledgers netted (as the Ledger list does), worded the way the Ledger
  // words it - "To receive" is money coming to you, "To pay" is money you owe.
  const netBalance = Math.round(balance - vendorBalance);
  const words =
    netBalance > 0
      ? { label: 'To receive', color: MONEY.in.text }
      : netBalance < 0
        ? { label: 'To pay', color: MONEY.out.text }
        : { label: 'Balance', color: '#374151' };
  const summary = <BalanceFigure label={words.label} value={`NPR ${Math.abs(netBalance).toLocaleString()}`} color={words.color} />;

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
            key={editingEntry?.id ?? `new-${entryPreset}`}
            defaultType={entryPreset}
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

        {historyView}
        <OptionMenuModal
          visible={exportMenu}
          title="Print / Download statement"
          options={[
            { key: 'print', label: 'Print (or save as PDF)' },
            { key: 'excel', label: 'Download Excel (.xlsx)' },
          ]}
          onPick={(kind) => runExport(kind)}
          onClose={() => setExportMenu(false)}
        />
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
