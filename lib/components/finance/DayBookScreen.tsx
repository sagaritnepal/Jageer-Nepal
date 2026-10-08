// lib/components/finance/DayBookScreen.tsx
import { Fragment, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { DateField } from '../DateTimeFields';
import { FormSection } from './FormSection';
import { BankAccountPickerModal } from './BankAccountPickerModal';
import { useWideDetail } from '../detail/DetailLayout';
import { dateLabels, useCalendarMode } from '../../hooks/useCalendarMode';
import { DateFilterButton } from './DateRangeFilter';
import { useBookToolbar } from './BookKit';
import { MONEY } from './moneyColors';
import { showAlert, getErrorMessage } from '../../utils/alert';

type Kind = 'opening' | 'received' | 'paid' | 'expense' | 'sale' | 'purchase' | 'transfer';

/** Where money sits: 'cash' for cash in hand, otherwise a bank_accounts id
 * (eSewa, Khalti, a bank...). */
type AccountKey = string;
const CASH: AccountKey = 'cash';
type AccountOption = { key: AccountKey; name: string };

/** One movement of money into or out of one account. A transfer has two (out
 * of one account, into the other); a sale or purchase bill has none. */
type Move = { account: AccountKey; amount: number; dir: 'in' | 'out' };

type BookRow = {
  id: string;
  kind: Kind;
  /** The day the entry sits on (YYYY-MM-DD); empty for the opening line. */
  date: string;
  time: string;
  details: string;
  sub: string | null;
  invoice: number | null;
  discount: number | null;
  /** Bill total (sale/purchase) or amount moved (transfer) - not cash. */
  amount: number | null;
  cashIn: number | null;
  cashOut: number | null;
  /** Running cash + bank balance after this row; null for non-cash rows. */
  balance: number | null;
  /** Name of the account the money went through, for the row's tag. */
  account: string | null;
  /** The same movement per account, so one account can be viewed on its own. */
  moves: Move[];
  sortKey: string;
  href?: string;
  /** What this row actually is in the database, so it can be edited here. */
  edit?: EditTarget;
};

type EditTable = 'customer_ledger_entries' | 'vendor_ledger_entries' | 'account_transfers';

type EditValues = {
  date: string;
  amount: string;
  party: string;
  billNo: string;
  discount: string;
  receiptNo: string;
  note: string;
  /** null means cash, like the Payment In form's method picker. */
  bankAccountId: string | null;
};

type EditTarget = {
  table: EditTable;
  id: string;
  title: string;
  /** Set when the entry belongs to something else (a job's payment, say) -
   * it is then shown read-only, since a change here would just be
   * overwritten by whatever created it. */
  lockedReason?: string;
  /** Which fields this kind of entry has. */
  fields: { party?: boolean; billNo?: boolean; discount?: boolean; receiptNo?: boolean; method?: boolean };
  /** Heading for the name section - "Customer", "Vendor", "Paid to"... */
  partyLabel?: string;
  /** Name to show when it isn't typed here but on the customer's own record. */
  subtitleParty?: string;
  /** Wording for the numbered field, as Payment In words it. */
  numberLabel?: string;
  values: EditValues;
};

const KIND: Record<Kind, { label: string; color: string; bg: string }> = {
  opening: { label: 'Opening', color: '#374151', bg: '#F3F4F6' },
  received: { label: 'Received', color: '#047857', bg: '#ECFDF5' },
  paid: { label: 'Payment Out', color: '#B91C1C', bg: '#FEF2F2' },
  expense: { label: 'Expense', color: '#B91C1C', bg: '#FEF2F2' },
  sale: { label: 'Sale bill', color: MONEY.in.text, bg: MONEY.in.bg },
  purchase: { label: 'Purchase bill', color: MONEY.out.text, bg: MONEY.out.bg },
  transfer: { label: 'Transfer', color: '#4338CA', bg: '#EEF2FF' },
};

/** Local calendar day of a timestamp, as YYYY-MM-DD - going through
 * toISOString would use UTC and shift late-evening Nepal entries a day. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function money(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

function amountText(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

// Full-table column widths; Transaction details takes the rest. All nine
// columns need about this much window to fit beside the sidebar - narrower
// than that and the table falls back to the compact four-column form rather
// than cutting off Cash in / Cash out / Balance.
const COL = { time: 58, type: 104, invoice: 96, discount: 76, amount: 104, cashIn: 100, cashOut: 100, balance: 112 };
const FULL_TABLE_MIN_WINDOW = 1280;

function TypePill({ kind }: { kind: Kind }) {
  const k = KIND[kind];
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: k.bg }}>
      <Text className="text-[10.5px] font-bold" style={{ color: k.color }} numberOfLines={1}>
        {k.label}
      </Text>
    </View>
  );
}

/** Which account an entry went through - Cash, eSewa, a bank... */
function AccountPill({ row }: { row: BookRow }) {
  if (!row.account) return null;
  const name = row.account;
  return (
    <View className="flex-row items-center self-start rounded-full border border-gray-300 bg-white px-2 py-0.5" style={{ gap: 3 }}>
      <Ionicons name={row.moves[0]?.account === CASH ? 'cash-outline' : 'business-outline'} size={10} color="#4B5563" />
      <Text className="text-[10.5px] font-semibold text-gray-600" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

/** Every entry of the day (or week / month) in one cash-book table, in date and
 * time order: opening balance first, then cash in / paid out / expenses (which
 * move the running balance) mixed with the sales and purchase bills and
 * transfers (which don't), closing balance last. `dayLabel` is given for a
 * view of more than one day, and puts a date band above each day's entries. */
function DayBookTable({ rows, opening, totalIn, totalOut, closing, full, dayLabel, onOpenRow }: {
  rows: BookRow[];
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  /** Show every column; otherwise Time | Details | Amount | Balance. */
  full: boolean;
  dayLabel?: (date: string) => string;
  onOpenRow: (row: BookRow) => void;
}) {
  const cell = 'px-2.5 py-2 border-r border-gray-200';
  const dayBand = (r: BookRow, index: number) =>
    dayLabel && r.kind !== 'opening' && rows[index - 1]?.date !== r.date ? (
      <View className="border-b border-gray-200 bg-gray-50 px-2.5 py-1.5">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{dayLabel(r.date)}</Text>
      </View>
    ) : null;
  const headCell = (label: string, style: object, right = false) => (
    <Text className={`${cell} text-[11.5px] font-bold text-gray-600 ${right ? 'text-right' : ''}`} style={style}>
      {label}
    </Text>
  );
  const num = (value: number | null, style: object, color = '#111827', bold = false) => (
    <Text
      className={`${cell} text-right text-[12.5px] ${bold ? 'font-bold' : 'font-medium'}`}
      style={[style, { color: value == null ? '#9CA3AF' : color }]}
      numberOfLines={1}
    >
      {value == null ? '—' : money(value)}
    </Text>
  );
  // Tapping an entry opens it for editing; the opening-balance line and
  // anything without a record behind it stays inert.
  const open = (r: BookRow) => (r.edit ? () => onOpenRow(r) : r.href ? () => router.push(r.href as any) : undefined);

  if (!full) {
    // Narrow: Time | Details (type, notes, invoice) | Amount | Balance.
    return (
      <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
        <View className="flex-row border-b border-gray-300 bg-gray-50">
          {headCell('Time', { width: 50 })}
          {headCell('Transaction details', { flex: 1 })}
          {headCell('Amount', { width: 82 }, true)}
          <Text className="px-2.5 py-2 text-right text-[11.5px] font-bold text-gray-600" style={{ width: 84 }}>
            Balance
          </Text>
        </View>
        {rows.map((r, index) => {
          const cash = r.cashIn ?? r.cashOut;
          const amountText = r.cashIn != null ? `+${money(r.cashIn)}` : r.cashOut != null ? `−${money(r.cashOut)}` : money(r.amount);
          const amountColor = r.cashIn != null ? '#047857' : r.cashOut != null ? '#B91C1C' : '#6B7280';
          return (
            <Fragment key={r.id}>
            {dayBand(r, index)}
            <Pressable onPress={open(r)} disabled={!r.edit && !r.href} className="flex-row border-b border-gray-200">
              <Text className={`${cell} text-[11.5px] text-gray-500`} style={{ width: 50 }} numberOfLines={1}>
                {r.time}
              </Text>
              <View className={cell} style={{ flex: 1, gap: 2 }}>
                <Text className={`text-[13px] text-gray-900 ${r.kind === 'opening' ? 'font-bold' : 'font-medium'}`} numberOfLines={2}>
                  {r.details}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                  <TypePill kind={r.kind} />
                  <AccountPill row={r} />
                </View>
                {!!r.sub && (
                  <Text className="text-[11px] text-gray-400" numberOfLines={r.kind === 'opening' ? undefined : 2}>
                    {r.sub}
                  </Text>
                )}
                {r.invoice != null && (
                  <Text className="text-[11px] text-gray-500">
                    Invoice {money(r.invoice)}
                    {r.discount ? ` · Discount ${money(r.discount)}` : ''}
                  </Text>
                )}
              </View>
              <Text
                className={`${cell} text-right text-[12.5px] ${cash != null ? 'font-bold' : 'font-medium'}`}
                style={{ width: 82, color: r.kind === 'opening' ? '#9CA3AF' : amountColor }}
              >
                {r.kind === 'opening' ? '—' : amountText}
              </Text>
              <Text
                className="px-2.5 py-2 text-right text-[12.5px] font-semibold"
                style={{ width: 84, color: r.balance == null ? '#9CA3AF' : '#111827' }}
              >
                {money(r.balance)}
              </Text>
            </Pressable>
            </Fragment>
          );
        })}
        <View className="flex-row bg-gray-50">
          <Text className={`${cell} flex-1 text-right text-[12.5px] font-bold text-gray-700`}>Closing balance</Text>
          <Text
            className="px-2.5 py-2 text-right text-[14px] font-extrabold"
            style={{ width: 84, color: closing >= 0 ? '#2563EB' : '#DC2626' }}
          >
            {money(closing)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <View>
          <View className="flex-row border-b border-gray-300 bg-gray-50">
            {headCell('Time', { width: COL.time })}
            {headCell('Transaction details', { flex: 1 })}
            {headCell('Type', { width: COL.type })}
            {headCell('Invoice', { width: COL.invoice }, true)}
            {headCell('Discount', { width: COL.discount }, true)}
            {headCell('Bill amount', { width: COL.amount }, true)}
            {headCell('Cash in', { width: COL.cashIn }, true)}
            {headCell('Cash out', { width: COL.cashOut }, true)}
            <Text className="px-2.5 py-2 text-right text-[11.5px] font-bold text-gray-600" style={{ width: COL.balance }}>
              Balance
            </Text>
          </View>

          {rows.map((r, index) => (
            <Fragment key={r.id}>
            {dayBand(r, index)}
            <Pressable
              onPress={open(r)}
              disabled={!r.edit && !r.href}
              className="flex-row border-b border-gray-200"
              style={r.kind === 'opening' ? { backgroundColor: '#FAFAFA' } : undefined}
            >
              <Text className={`${cell} text-[12.5px] text-gray-500`} style={{ width: COL.time }} numberOfLines={1}>
                {r.time}
              </Text>
              <View className={cell} style={{ flex: 1, minWidth: 0 }}>
                <Text className={`text-[13px] text-gray-900 ${r.kind === 'opening' ? 'font-bold' : 'font-medium'}`} numberOfLines={1}>
                  {r.details}
                </Text>
                {!!r.sub && (
                  <Text className="text-[11px] text-gray-400" numberOfLines={r.kind === 'opening' ? undefined : 1}>
                    {r.sub}
                  </Text>
                )}
              </View>
              <View className={cell} style={{ width: COL.type, gap: 3 }}>
                <TypePill kind={r.kind} />
                <AccountPill row={r} />
              </View>
              {num(r.invoice, { width: COL.invoice }, '#4B5563')}
              {num(r.discount, { width: COL.discount }, '#4B5563')}
              {num(r.amount, { width: COL.amount }, KIND[r.kind].color)}
              {num(r.cashIn, { width: COL.cashIn }, '#047857', true)}
              {num(r.cashOut, { width: COL.cashOut }, '#B91C1C', true)}
              <Text
                className="px-2.5 py-2 text-right text-[13px] font-bold"
                style={{ width: COL.balance, color: r.balance == null ? '#9CA3AF' : '#111827' }}
              >
                {money(r.balance)}
              </Text>
            </Pressable>
            </Fragment>
          ))}

          <View className="flex-row bg-gray-50">
            <Text className={`${cell} flex-1 text-right text-[12.5px] font-bold text-gray-700`}>
              Opening {money(opening)} + In {money(totalIn)} − Out {money(totalOut)} = Closing balance
            </Text>
            <Text className={`${cell} text-right text-[13px] font-extrabold`} style={{ width: COL.cashIn, color: '#047857' }}>
              {money(totalIn)}
            </Text>
            <Text className={`${cell} text-right text-[13px] font-extrabold`} style={{ width: COL.cashOut, color: '#B91C1C' }}>
              {money(totalOut)}
            </Text>
            <Text
              className="px-2.5 py-2 text-right text-[14px] font-extrabold"
              style={{ width: COL.balance, color: closing >= 0 ? '#2563EB' : '#DC2626' }}
            >
              {money(closing)}
            </Text>
          </View>
      </View>
    </View>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3.5">
      <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      {children}
    </View>
  );
}

function EditInput(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      className={`rounded-lg border px-4 py-3 text-base ${props.editable === false ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-300 bg-white text-gray-900'}`}
    />
  );
}

/** Edit or delete one entry without leaving the Day Book. Writes go to the
 * row's own table, so the ledgers, balances and the rest of Finance follow
 * along - a sale's customer debit, for one, is kept in step by a database
 * trigger. */
function EditEntryModal({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const bankAccounts = useBankAccounts(userId);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const updates = {
    customer_ledger_entries: useSupabaseUpdate('customer_ledger_entries'),
    vendor_ledger_entries: useSupabaseUpdate('vendor_ledger_entries'),
    account_transfers: useSupabaseUpdate('account_transfers'),
  };
  const removals = {
    customer_ledger_entries: useSupabaseDelete('customer_ledger_entries'),
    vendor_ledger_entries: useSupabaseDelete('vendor_ledger_entries'),
    account_transfers: useSupabaseDelete('account_transfers'),
  };
  const [form, setForm] = useState<EditValues | undefined>(target?.values);
  const [busy, setBusy] = useState(false);
  // Deleting asks a second time in the sheet itself rather than through a
  // pop-up: the confirmation sits under the reader's finger, right where
  // the first tap was, and can't be missed behind this window.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setForm(target?.values);
    setConfirmingDelete(false);
  }, [target]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  if (!target || !form) return null;
  const locked = !!target.lockedReason;
  const accountName = form.bankAccountId
    ? (bankAccounts.accounts.find((a) => a.id === form.bankAccountId)?.name ?? 'Bank')
    : 'Cash';
  const set = (key: keyof EditValues) => (value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));

  // Each table keeps its own column names; the Day Book only ever changes
  // what is actually visible on the row.
  function valuesFor(values: EditValues): Record<string, unknown> {
    const amount = Number(values.amount);
    const note = values.note.trim() || null;
    switch (target!.table) {
      case 'customer_ledger_entries':
      case 'vendor_ledger_entries':
        return {
          entry_date: values.date,
          amount,
          receipt_no: values.receiptNo.trim() || null,
          bank_account_id: values.bankAccountId,
          note,
        };
      case 'account_transfers':
        return { transfer_date: values.date, amount, note };
    }
  }

  async function refreshEverything() {
    // A bill's trigger writes to the ledgers, so refresh all of them.
    await Promise.all(
      ['business_transactions', 'customer_ledger_entries', 'vendor_ledger_entries', 'account_transfers'].map((t) =>
        queryClient.invalidateQueries({ queryKey: [t] })
      )
    );
  }

  async function handleSave() {
    const values = form!;
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert('Check the amount', 'Enter an amount greater than zero.');
      return;
    }
    if (!values.date) {
      showAlert('Pick a date', 'Every entry needs a date.');
      return;
    }
    setBusy(true);
    try {
      await updates[target!.table].mutateAsync({ id: target!.id, values: valuesFor(values) as never });
      await refreshEverything();
      onClose();
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setBusy(true);
    try {
      await removals[target!.table].mutateAsync(target!.id);
      await refreshEverything();
      onClose();
    } catch (err) {
      showAlert('Could not delete', getErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={onClose}>
          <Pressable onPress={() => {}} className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 460, maxHeight: '90%' }}>
            <View className="flex-row items-center gap-2.5 px-5 py-4" style={{ backgroundColor: '#1D4ED8' }}>
              <View className="flex-1">
                <Text className="text-[16px] font-bold text-white">{locked ? 'Entry details' : 'Edit entry'}</Text>
                <Text className="mt-0.5 text-[11.5px] text-white/85">{target.title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              {locked && (
                <View className="mb-4 flex-row items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <Ionicons name="lock-closed-outline" size={16} color="#B45309" />
                  <Text className="flex-1 text-xs leading-[17px] text-amber-900">{target.lockedReason}</Text>
                </View>
              )}

              {/* Same order and the same field blocks as the Payment In
                  form, so an entry reads the way it was written. */}
              <FormSection icon="document-text-outline" title="Details" first>
                <View className="flex-row" style={{ gap: 10 }}>
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-medium text-gray-500">Date</Text>
                    {locked ? (
                      <EditInput value={form.date} editable={false} />
                    ) : (
                      <DateField value={form.date} onChange={(v) => v && set('date')(v)} />
                    )}
                  </View>
                  {(target.fields.receiptNo || target.fields.billNo) && (
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-medium text-gray-500">{target.numberLabel ?? 'Receipt No.'}</Text>
                      <EditInput
                        value={target.fields.billNo ? form.billNo : form.receiptNo}
                        onChangeText={target.fields.billNo ? set('billNo') : set('receiptNo')}
                        placeholder="Optional"
                        editable={!locked}
                      />
                    </View>
                  )}
                </View>
              </FormSection>

              {target.fields.method && (
                <FormSection icon="wallet-outline" title="Payment method">
                  <Pressable
                    onPress={() => !locked && setShowAccountPicker(true)}
                    disabled={locked}
                    className={`flex-row items-center justify-between rounded-lg border px-3 py-2.5 ${locked ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'}`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name={form.bankAccountId ? 'business-outline' : 'cash-outline'} size={16} color="#6B7280" />
                      <Text className={`text-sm ${locked ? 'text-gray-500' : 'text-gray-900'}`}>{accountName}</Text>
                    </View>
                    {!locked && <Ionicons name="chevron-down" size={16} color="#9CA3AF" />}
                  </Pressable>
                </FormSection>
              )}

              {target.fields.party && (
                <FormSection icon="person-outline" title={target.partyLabel ?? 'Customer'}>
                  <EditInput value={form.party} onChangeText={set('party')} placeholder="Name" editable={!locked} />
                </FormSection>
              )}

              {!target.fields.party && !!target.subtitleParty && (
                <FormSection icon="person-outline" title={target.partyLabel ?? 'Customer'}>
                  <EditInput value={target.subtitleParty} editable={false} />
                </FormSection>
              )}

              <FormSection icon="cash-outline" title="Amount">
                <View className="flex-row" style={{ gap: 10 }}>
                  <View className="flex-1">
                    <Text className="mb-1 text-xs font-medium text-gray-500">Amount (NPR)</Text>
                    <EditInput
                      value={form.amount}
                      onChangeText={(v) => set('amount')(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      editable={!locked}
                    />
                  </View>
                  {target.fields.discount && (
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-medium text-gray-500">Discount (NPR)</Text>
                      <EditInput
                        value={form.discount}
                        onChangeText={(v) => set('discount')(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        editable={!locked}
                      />
                    </View>
                  )}
                </View>
                <View className="mt-3">
                  <Text className="mb-1 text-xs font-medium text-gray-500">Remarks</Text>
                  <EditInput
                    value={form.note}
                    onChangeText={set('note')}
                    placeholder="Optional"
                    multiline
                    style={{ minHeight: 70, textAlignVertical: 'top' }}
                    editable={!locked}
                  />
                </View>
              </FormSection>

              {!locked && (
                <>
                  <Pressable
                    onPress={handleSave}
                    disabled={busy}
                    className="h-12 flex-row items-center justify-center gap-2 rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: '#1D4ED8' }}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text className="text-base font-semibold text-white">{busy ? 'Saving...' : 'Save changes'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    disabled={busy}
                    className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3 disabled:opacity-50"
                    style={
                      confirmingDelete
                        ? { backgroundColor: '#DC2626' }
                        : { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }
                    }
                  >
                    <Ionicons name="trash-outline" size={17} color={confirmingDelete ? '#FFFFFF' : '#DC2626'} />
                    <Text className={`text-sm font-semibold ${confirmingDelete ? 'text-white' : 'text-red-600'}`}>
                      {confirmingDelete ? 'Tap again to delete for good' : 'Delete entry'}
                    </Text>
                  </Pressable>
                  {confirmingDelete && (
                    <Text className="mt-2 text-center text-[11px] text-gray-400">
                      It disappears from the Day Book and from every total that counted it.
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <BankAccountPickerModal
        visible={showAccountPicker}
        accounts={bankAccounts.accounts}
        selectedId={form.bankAccountId}
        onSelect={(id) => setForm((f) => (f ? { ...f, bankAccountId: id } : f))}
        onClose={() => setShowAccountPicker(false)}
        onRename={bankAccounts.rename}
        onDelete={bankAccounts.remove}
      />
    </Modal>
  );
}

/** The five things a day can gain, behind one button - the same forms the
 * Finance menu opens, without leaving the Day Book to find them. */
const NEW_ENTRY_KINDS: { key: string; label: string; icon: ComponentProps<typeof Ionicons>['name']; color: string; path: string }[] = [
  { key: 'received', label: 'Received', icon: 'arrow-down-circle', color: '#059669', path: '/quick-payment?type=in' },
  { key: 'payment-out', label: 'Payment Out', icon: 'arrow-up-circle', color: '#DC2626', path: '/quick-payment?type=out' },
  { key: 'sale', label: 'Sale', icon: 'trending-up', color: '#059669', path: '/transactions?type=sale&add=1' },
  { key: 'purchase', label: 'Purchase', icon: 'cart', color: '#DC2626', path: '/transactions?type=purchase&add=1' },
  { key: 'expense', label: 'Expense', icon: 'receipt', color: '#DC2626', path: '/transactions?type=expense&add=1' },
];

function NewEntryMenu({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="New entry, choose what to record"
        accessibilityState={{ expanded: open }}
        className="h-9 flex-row items-center justify-center gap-1.5 rounded-lg px-3.5"
        style={{ backgroundColor: '#1D4ED8' }}
      >
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text className="text-[13px] font-semibold text-white">New entry</Text>
        <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} accessibilityViewIsModal className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 380 }}>
            <View className="flex-row items-center gap-2.5 px-5 py-4" style={{ backgroundColor: '#1D4ED8' }}>
              <Text className="flex-1 text-[16px] font-bold text-white">What are you recording?</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            {NEW_ENTRY_KINDS.map((kind, i) => (
              <Pressable
                key={kind.key}
                accessibilityRole="button"
                accessibilityLabel={kind.label}
                onPress={() => {
                  setOpen(false);
                  router.push(`${basePath}${kind.path}` as any);
                }}
                className={`flex-row items-center gap-3 px-5 py-3.5 ${i === NEW_ENTRY_KINDS.length - 1 ? '' : 'border-b border-gray-100'}`}
              >
                <Ionicons name={kind.icon} size={20} color={kind.color} />
                <Text className="flex-1 text-[15px] font-semibold text-gray-900">{kind.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** A button floating over the bottom corner of the page that picks which account
 * the Day Book shows: all of them together, Cash, or one bank / wallet. It names
 * the account in use, and opens a small menu above itself; tapping anywhere else
 * closes the menu. */
function AccountPicker({ options, selected, onSelect }: {
  options: AccountOption[];
  /** null is every account together. */
  selected: AccountKey | null;
  onSelect: (key: AccountKey | null) => void;
}) {
  const [open, setOpen] = useState(false);
  type IconName = ComponentProps<typeof Ionicons>['name'];
  const iconFor = (key: AccountKey | null): IconName => (key == null ? 'wallet-outline' : key === CASH ? 'cash-outline' : 'business-outline');
  const current = options.find((o) => o.key === selected);
  const choices: { key: AccountKey | null; name: string }[] = [{ key: null, name: 'All accounts' }, ...options];

  return (
    <>
      {open && (
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close account menu"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
        />
      )}
      <View style={{ position: 'absolute', right: 16, bottom: 16, alignItems: 'flex-end', gap: 8, zIndex: 11 }}>
        {open && (
          <View
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            style={{ minWidth: 210, maxHeight: 340, boxShadow: '0 12px 32px rgba(16,24,40,0.22)' }}
          >
            <Text className="border-b border-gray-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Show money through
            </Text>
            <ScrollView>
              {choices.map((c) => {
                const on = c.key === (current?.key ?? null);
                return (
                  <Pressable
                    key={c.key ?? 'all'}
                    onPress={() => {
                      onSelect(c.key);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className="flex-row items-center px-4 py-3"
                    style={{ gap: 10, backgroundColor: on ? '#EFF6FF' : undefined }}
                  >
                    <Ionicons name={iconFor(c.key)} size={17} color={on ? '#1D4ED8' : '#6B7280'} />
                    <Text className={`flex-1 text-[14px] ${on ? 'font-bold text-blue-700' : 'font-medium text-gray-900'}`} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {on && <Ionicons name="checkmark" size={17} color="#1D4ED8" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={`Showing ${current?.name ?? 'all accounts'}. Choose an account`}
          accessibilityState={{ expanded: open }}
          className="h-11 flex-row items-center rounded-full px-4"
          style={{ gap: 8, backgroundColor: '#1D4ED8', boxShadow: '0 8px 20px rgba(29,78,216,0.35)' }}
        >
          <Ionicons name={iconFor(current?.key ?? null)} size={17} color="#FFFFFF" />
          <Text className="max-w-[180px] text-[14px] font-semibold text-white" numberOfLines={1}>
            {current?.name ?? 'All accounts'}
          </Text>
          <Ionicons name={open ? 'chevron-down' : 'chevron-up'} size={15} color="#FFFFFF" />
        </Pressable>
      </View>
    </>
  );
}

/** The day's money laid out like a paper cash book, as one table. Uses the
 * dashboard's definitions - a sale or purchase books a debt rather than
 * moving cash, the ledger rows it creates are skipped so nothing counts
 * twice, and entries sit on the date the user gave them. The opening balance
 * is every cash movement dated before this day, the same formula as the
 * Available Balance (useAccountBalances), so the two always agree. */
export function DayBookScreen({ basePath }: { basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useWideDetail();
  const { width: windowWidth } = useWindowDimensions();
  const fullTable = wide && windowWidth >= FULL_TABLE_MIN_WINDOW;
  const [calendarMode] = useCalendarMode();
  const today = localDay(new Date().toISOString());
  // What the Filter button sets: today by default, otherwise a range. An empty
  // From reaches back to the start of the books (so nothing is carried in as an
  // opening balance); an empty To runs through today.
  const [range, setRange] = useState({ from: today, to: today });
  const from = range.from;
  const day = range.to || today;
  const singleDay = from === day;
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // null shows every account together; otherwise just what went through that one.
  const [selectedAccount, setSelectedAccount] = useState<AccountKey | null>(null);

  const owner: Record<string, string> = userId ? { owner_id: userId } : {};
  const { data: transactions, isLoading } = useSupabaseQuery('business_transactions', { filters: owner, enabled: !!userId });
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: transfers } = useSupabaseQuery('account_transfers', { filters: owner, enabled: !!userId });
  const { data: contacts } = useSupabaseQuery('customers', { filters: owner, enabled: !!userId });
  const { data: accounts } = useSupabaseQuery('bank_accounts', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });
  const { data: categories } = useSupabaseQuery('expense_categories', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });

  const book = useMemo(() => {
    const contactName = new Map((contacts ?? []).map((c) => [c.id, c.name]));
    const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
    const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const via = (bankId: string | null) => (bankId ? (accountName.get(bankId) ?? 'Other account') : 'Cash');
    const keyOf = (bankId: string | null): AccountKey => bankId ?? CASH;
    const blank = { invoice: null, discount: null, amount: null, cashIn: null, cashOut: null, balance: null, account: null, moves: [] as Move[] };

    // Every account's balance at the start of the day. Transfers count here -
    // they leave one account and enter another - though they net to nothing in
    // the combined `opening`, so that total is unchanged by them.
    const openingBy: Record<AccountKey, number> = {};
    const carry = (account: AccountKey, delta: number) => {
      openingBy[account] = (openingBy[account] ?? 0) + delta;
    };
    let opening = 0;
    const rows: BookRow[] = [];

    for (const t of transactions ?? []) {
      const date = t.bill_date ?? localDay(t.created_at);
      if (t.type === 'expense' && date < from) {
        opening -= t.amount;
        carry(keyOf(t.bank_account_id), -t.amount);
      }
      if (date < from || date > day) continue;
      const discount = t.discount_amount ?? 0;
      const category = t.expense_category_id ? categoryName.get(t.expense_category_id) : null;
      const isExpense = t.type === 'expense';
      rows.push({
        ...blank,
        id: t.id,
        kind: isExpense ? 'expense' : t.type === 'sale' ? 'sale' : 'purchase',
        date,
        time: timeOf(t.created_at),
        details: isExpense
          ? t.party_name || category || 'Expense'
          : t.party_name || (t.type === 'sale' ? 'Sale' : 'Purchase'),
        sub:
          [
            t.bill_no ? `Bill #${t.bill_no}` : null,
            isExpense && t.party_name ? category : null,
            t.note,
            !isExpense && t.payment_mode === 'credit' ? 'On credit' : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        // Invoice is the value before discount and VAT; the bill amount after.
        invoice: t.amount + discount - (t.vat_amount ?? 0),
        discount,
        // An expense is paid on the spot, so it's cash out; a sale or
        // purchase bill is a debt until its payment is recorded.
        amount: isExpense ? null : t.amount,
        cashOut: isExpense ? t.amount : null,
        account: isExpense ? via(t.bank_account_id) : null,
        moves: isExpense ? [{ account: keyOf(t.bank_account_id), amount: t.amount, dir: 'out' }] : [],
        sortKey: t.created_at,
        // A bill opens on its own page - the very page that recorded it, with the
        // bill loaded - rather than in a cut-down popup.
        href: `${basePath}/transactions?type=${t.type}&add=1&edit=${t.id}`,
      });
    }

    for (const e of customerEntries ?? []) {
      const isIn = e.entry_type === 'credit';
      // Booking debits are the Sale itself, not cash.
      if (!isIn && e.source !== 'manual') continue;
      const date = e.entry_date ?? localDay(e.created_at);
      if (date < from) {
        opening += isIn ? e.amount : -e.amount;
        carry(keyOf(e.bank_account_id), isIn ? e.amount : -e.amount);
      }
      if (date < from || date > day) continue;
      rows.push({
        ...blank,
        id: e.id,
        kind: isIn ? 'received' : 'paid',
        date,
        time: timeOf(e.created_at),
        details: `${isIn ? 'Received from' : 'Payment Out to'} ${contactName.get(e.customer_id) ?? 'customer'}`,
        sub: [e.receipt_no ? `${isIn ? 'Receipt' : 'Payment'} No. ${e.receipt_no}` : null, e.note].filter(Boolean).join(' · ') || null,
        cashIn: isIn ? e.amount : null,
        cashOut: isIn ? null : e.amount,
        account: via(e.bank_account_id),
        moves: [{ account: keyOf(e.bank_account_id), amount: e.amount, dir: isIn ? 'in' : 'out' }],
        sortKey: e.created_at,
        edit: {
          table: 'customer_ledger_entries',
          id: e.id,
          title: `${isIn ? 'Received from' : 'Payment Out to'} ${contactName.get(e.customer_id) ?? 'customer'}`,
          lockedReason:
            e.source === 'manual'
              ? undefined
              : 'This was recorded by a job when its payment was collected. Change it on the job, and this entry follows.',
          fields: { receiptNo: true, method: true },
          partyLabel: 'Customer',
          numberLabel: isIn ? 'Receipt No.' : 'Payment No.',
          subtitleParty: contactName.get(e.customer_id) ?? 'Customer',
          values: {
            date,
            amount: amountText(e.amount),
            party: '',
            billNo: '',
            discount: '',
            receiptNo: e.receipt_no ?? '',
            note: e.note ?? '',
            bankAccountId: e.bank_account_id ?? null,
          },
        },
      });
    }

    for (const e of vendorEntries ?? []) {
      // Only payments to a vendor move money; debits are the Purchase.
      if (e.entry_type !== 'credit') continue;
      const date = e.entry_date ?? localDay(e.created_at);
      if (date < from) {
        opening -= e.amount;
        carry(keyOf(e.bank_account_id), -e.amount);
      }
      if (date < from || date > day) continue;
      rows.push({
        ...blank,
        id: e.id,
        kind: 'paid',
        date,
        time: timeOf(e.created_at),
        details: `Payment Out to ${contactName.get(e.vendor_id) ?? 'vendor'}`,
        sub: [e.receipt_no ? `Payment No. ${e.receipt_no}` : null, e.note].filter(Boolean).join(' · ') || null,
        cashOut: e.amount,
        account: via(e.bank_account_id),
        moves: [{ account: keyOf(e.bank_account_id), amount: e.amount, dir: 'out' }],
        sortKey: e.created_at,
        edit: {
          table: 'vendor_ledger_entries',
          id: e.id,
          title: `Payment Out to ${contactName.get(e.vendor_id) ?? 'vendor'}`,
          lockedReason:
            e.source === 'manual'
              ? undefined
              : 'This was recorded by a purchase bill. Edit the bill and this entry follows.',
          fields: { receiptNo: true, method: true },
          partyLabel: 'Vendor',
          numberLabel: 'Payment No.',
          subtitleParty: contactName.get(e.vendor_id) ?? 'Vendor',
          values: {
            date,
            amount: amountText(e.amount),
            party: '',
            billNo: '',
            discount: '',
            receiptNo: e.receipt_no ?? '',
            note: e.note ?? '',
            bankAccountId: e.bank_account_id ?? null,
          },
        },
      });
    }

    // A transfer only moves money between the owner's own accounts, so it
    // never changes the combined balance - listed for reference only.
    for (const tr of transfers ?? []) {
      const date = tr.transfer_date ?? localDay(tr.created_at);
      if (date < from) {
        carry(keyOf(tr.from_account_id), -tr.amount);
        carry(keyOf(tr.to_account_id), tr.amount);
      }
      if (date < from || date > day) continue;
      rows.push({
        ...blank,
        id: tr.id,
        kind: 'transfer',
        date,
        time: timeOf(tr.created_at),
        details: `${via(tr.from_account_id)} → ${via(tr.to_account_id)}`,
        sub: tr.note,
        amount: tr.amount,
        moves: [
          { account: keyOf(tr.from_account_id), amount: tr.amount, dir: 'out' },
          { account: keyOf(tr.to_account_id), amount: tr.amount, dir: 'in' },
        ],
        sortKey: tr.created_at,
        edit: {
          table: 'account_transfers',
          id: tr.id,
          title: `${via(tr.from_account_id)} to ${via(tr.to_account_id)}`,
          fields: {},
          partyLabel: 'Between accounts',
          subtitleParty: `${via(tr.from_account_id)} to ${via(tr.to_account_id)}`,
          values: {
            date: tr.transfer_date ?? localDay(tr.created_at),
            amount: amountText(tr.amount),
            party: '',
            billNo: '',
            discount: '',
            receiptNo: '',
            note: tr.note ?? '',
            bankAccountId: null,
          },
        },
      });
    }

    // By the day each entry sits on, then by when it was entered - so a longer
    // view reads in date order and the running balance follows it.
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.sortKey.localeCompare(b.sortKey));

    // Where the opening balance sits, account by account - what each account held
    // at the start of the period, which adds up to the Opening balance.
    // An entry can point at an account that isn't in the list (one that was
    // removed, say); it still gets its own place here, so the accounts always
    // add up to the opening balance.
    const listed = [{ key: CASH, name: 'Cash' }, ...(accounts ?? []).map((a) => ({ key: a.id, name: a.name }))];
    const listedKeys = new Set(listed.map((o) => o.key));
    // Accounts seen either before the period (an opening balance) or in it (an entry).
    const seen = new Set([...Object.keys(openingBy), ...rows.flatMap((r) => r.moves.map((m) => m.account))]);
    const stray = accounts ? [...seen].filter((k) => !listedKeys.has(k)) : [];
    const openingByAccount = [...listed, ...stray.map((key) => ({ key, name: 'Other account' }))]
      .map((o) => ({ name: o.name, amount: openingBy[o.key] ?? 0 }))
      .filter((a) => Math.round(a.amount) !== 0);

    // One account on its own: its opening balance, and only the entries that
    // touched it. A transfer is a real in or out there, unlike in the combined
    // view where it nets to nothing.
    const accountOptions: AccountOption[] = [...listed, ...stray.map((key) => ({ key, name: 'Other account' }))];
    const selected = accountOptions.find((o) => o.key === selectedAccount) ?? null;
    let viewRows = rows;
    let viewOpening = opening;
    if (selected) {
      viewOpening = openingBy[selected.key] ?? 0;
      viewRows = rows
        .filter((r) => r.moves.some((m) => m.account === selected.key))
        .map((r) => {
          const mine = r.moves.filter((m) => m.account === selected.key);
          const cashIn = mine.filter((m) => m.dir === 'in').reduce((sum, m) => sum + m.amount, 0);
          const cashOut = mine.filter((m) => m.dir === 'out').reduce((sum, m) => sum + m.amount, 0);
          return { ...r, cashIn: cashIn || null, cashOut: cashOut || null, amount: r.kind === 'transfer' ? null : r.amount };
        });
    }

    let running = viewOpening;
    let totalIn = 0;
    let totalOut = 0;
    for (const r of viewRows) {
      if (r.cashIn != null || r.cashOut != null) {
        totalIn += r.cashIn ?? 0;
        totalOut += r.cashOut ?? 0;
        running += (r.cashIn ?? 0) - (r.cashOut ?? 0);
        r.balance = running;
      }
    }

    // "Cash -13,259  +  Esewa -103,771  +  Jyoti Bikash Bank 416,777  =  299,747" - only
    // when more than one account holds money; with one (or none) there is nothing to add up.
    const openingSub = selected
      ? `${selected.name} at the start of ${singleDay ? 'the day' : 'this period'}`
      : openingByAccount.length > 1
        ? `${openingByAccount.map((a) => `${a.name} ${money(a.amount)}`).join('  +  ')}  =  ${money(opening)}`
        : null;

    const openingRow: BookRow = {
      ...blank,
      id: 'opening',
      kind: 'opening',
      date: '',
      time: '',
      details: 'Opening balance',
      sub: openingSub,
      balance: viewOpening,
      sortKey: '',
    };

    return {
      rows: [openingRow, ...viewRows],
      entryCount: viewRows.length,
      opening: viewOpening,
      totalIn,
      totalOut,
      closing: running,
      openingByAccount,
      accountOptions,
      selected,
    };
  }, [transactions, customerEntries, vendorEntries, transfers, contacts, accounts, categories, day, from, singleDay, basePath, selectedAccount]);

  // The date band above each day of a longer view.
  const dayLabel = (date: string) => dateLabels(date, calendarMode).join('  ·  ');

  // Today is the resting state, so the button reads "Today" and carries no
  // range; anything else shows as the range, and clearing it comes back to today.
  const isToday = from === today && day === today;
  const applyRange = (f: string, t: string) => setRange(f || t ? { from: f, to: t } : { from: today, to: today });

  // The Filter button and New entry live in the top bar on a wide screen, and as
  // a plain row above the tiles on a narrow one.
  const toolbar = useBookToolbar(
    {
      wide,
      right: () => (
        <>
          <DateFilterButton
            from={isToday ? '' : range.from}
            to={isToday ? '' : range.to}
            idleLabel="Today"
            onApply={applyRange}
          />
          <NewEntryMenu basePath={basePath} />
        </>
      ),
    },
    [range, isToday, today, basePath]
  );

  const loaded = !(isLoading && !transactions);

  return (
    <View className="flex-1 bg-gray-50">
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: wide ? 24 : 12, paddingTop: wide ? 24 : 12, paddingBottom: 96, gap: 14 }}
    >
      {toolbar}

      {isLoading && !transactions ? (
        <Text className="px-1 text-sm text-gray-500">Loading…</Text>
      ) : (
        <>
          <DayBookTable
            rows={book.rows}
            opening={book.opening}
            totalIn={book.totalIn}
            totalOut={book.totalOut}
            closing={book.closing}
            full={fullTable}
            dayLabel={singleDay ? undefined : dayLabel}
            onOpenRow={(row) => row.edit && setEditing(row.edit)}
          />

          <EditEntryModal target={editing} onClose={() => setEditing(null)} />

          {book.entryCount === 0 && (
            <Text className="px-1 text-[13px] text-gray-500">
              {`No ${book.selected ? `${book.selected.name} entries` : 'entries'} ${singleDay ? 'on this day.' : 'in this period.'}`}
            </Text>
          )}

          <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
            Tap any entry to edit, save or delete it. The button at the bottom picks Cash, Esewa, a bank or all
            accounts - a transfer shows under an account as money in or out. Sale and purchase bills show what was billed that day - they
            don't change the balance until the money is received or paid, which appears as its own Received or Payment
            Out row.
          </Text>
        </>
      )}
    </ScrollView>
    {loaded && <AccountPicker options={book.accountOptions} selected={book.selected?.key ?? null} onSelect={setSelectedAccount} />}
    </View>
  );
}
