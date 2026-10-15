// lib/components/finance/JournalVoucherForm.tsx
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { SuggestInput } from './SuggestInput';
import { DateField } from '../DateTimeFields';
import { Field, FieldRow, FormActions, INPUT } from './FormKit';
import { PartyMoveField } from './EntryEditParts';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { localTodayIso } from '../../utils/localDate';
import { journalNote, newJournalCode } from '../../utils/journalVoucher';

type Person = { id: string; name: string };

/** Whether a person has any entry on one of the two ledgers. */
async function hasEntries(table: 'customer_ledger_entries' | 'vendor_ledger_entries', column: 'customer_id' | 'vendor_id', id: string) {
  const { count, error } = await (supabase.from(table) as any).select('id', { count: 'exact', head: true }).eq(column, id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** The Journal voucher form: an amount moved from one person's ledger to another's. No cash or bank
 * account is touched (see journalVoucher.ts for how the two halves are kept). Meant to sit in a
 * PopupCard. */
export function JournalVoucherForm({ ownerId, onDone }: { ownerId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState<Person | null>(null);
  const [to, setTo] = useState<Person | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localTodayIso());
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);
  // The debit side is either a person's ledger or an expense head (Salary, Rent ...): a voucher that
  // charges an expense with no cash moving, owed to the person on the credit side.
  const [debitKind, setDebitKind] = useState<'party' | 'expense'>('party');
  const [head, setHead] = useState('');
  const { data: categories, refetch: refetchCategories } = useSupabaseQuery('expense_categories', {
    filters: { owner_id: ownerId },
    orderBy: { column: 'name' },
  });
  const headOptions = useMemo(() => {
    const q = head.trim().toLowerCase();
    return (categories ?? [])
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 12)
      .map((c) => ({ key: c.id, label: c.name }));
  }, [categories, head]);

  async function handleSave() {
    const value = Number(amount);
    const toExpense = debitKind === 'expense';
    if (!from || (!toExpense && !to)) {
      showAlert(toExpense ? 'Pick the credit person' : 'Pick both people', toExpense ? 'Choose who the expense is owed to.' : 'A journal voucher moves an amount from one person to another.');
      return;
    }
    if (toExpense && !head.trim()) {
      showAlert('Pick an expense head', 'Choose or type the expense, for example Salary.');
      return;
    }
    if (!toExpense && to && from.id === to.id) {
      showAlert('Pick two different people', 'The two sides of a voucher cannot be the same person.');
      return;
    }
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    if (!date) {
      showAlert('Pick a date', 'Choose the date of this voucher.');
      return;
    }
    setSaving(true);
    try {
      const note = journalNote(newJournalCode(), narration);
      if (toExpense) {
        const name = head.trim();
        const existing = (categories ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase());
        let categoryId = existing?.id ?? null;
        if (!categoryId) {
          const created = await (supabase.from('expense_categories') as any).insert({ owner_id: ownerId, name }).select('id').single();
          if (created.error) throw created.error;
          categoryId = created.data.id as string;
        }
        const expense = await (supabase.from('business_transactions') as any)
          .insert({
            owner_id: ownerId,
            type: 'expense',
            amount: value,
            party_name: from.name,
            customer_id: from.id,
            note,
            bill_date: date,
            expense_category_id: categoryId,
            payment_mode: 'credit',
            bank_account_id: null,
          })
          .select('id')
          .single();
        if (expense.error) throw expense.error;
        const owed = await (supabase.from('customer_ledger_entries') as any).insert({
          owner_id: ownerId,
          amount: value,
          note,
          source: 'manual',
          entry_date: date,
          bank_account_id: null,
          customer_id: from.id,
          entry_type: 'credit',
        });
        if (owed.error) {
          await (supabase.from('business_transactions') as any).delete().eq('id', expense.data.id);
          throw owed.error;
        }
        await Promise.all(
          ['customer_ledger_entries', 'business_transactions', 'expense_categories'].map((table) => queryClient.invalidateQueries({ queryKey: [table] }))
        );
        await refetchCategories();
        onDone();
        return;
      }
      const toParty = to as Person;
      // Debited: on their vendor ledger when that is the only ledger they have, else on their customer ledger.
      const [toVendor, toCustomer] = await Promise.all([
        hasEntries('vendor_ledger_entries', 'vendor_id', toParty.id),
        hasEntries('customer_ledger_entries', 'customer_id', toParty.id),
      ]);
      const onVendorLedger = toVendor && !toCustomer;
      const common = { owner_id: ownerId, amount: value, note, source: 'manual', entry_date: date, bank_account_id: null };

      const credited = await (supabase.from('customer_ledger_entries') as any).insert({
        ...common,
        customer_id: from.id,
        entry_type: 'credit',
      });
      if (credited.error) throw credited.error;

      const debited = await (supabase.from(onVendorLedger ? 'vendor_ledger_entries' : 'customer_ledger_entries') as any).insert(
        onVendorLedger
          ? { ...common, vendor_id: toParty.id, entry_type: 'credit' }
          : { ...common, customer_id: toParty.id, entry_type: 'debit' }
      );
      if (debited.error) {
        // Take the first half back, so a voucher is never half of one.
        await (supabase.from('customer_ledger_entries') as any).delete().eq('owner_id', ownerId).eq('note', note);
        throw debited.error;
      }
      await Promise.all(
        ['customer_ledger_entries', 'vendor_ledger_entries'].map((table) => queryClient.invalidateQueries({ queryKey: [table] }))
      );
      onDone();
    } catch (err) {
      showAlert('Could not save the voucher', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FieldRow>
        <Field label="Date" basis={220}>
          <DateField value={date} onChange={setDate} />
        </Field>
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
      </FieldRow>
      <Text className="text-[12px] text-gray-500">
        Moves an amount from one person's ledger to another's. No cash or bank account is touched.
      </Text>
      <View className="gap-2">
        <Text className="text-[12px] font-semibold text-gray-600">Debit</Text>
        <View className="flex-row self-start rounded-lg bg-gray-100 p-0.5">
          {([['party', 'Person'], ['expense', 'Expense head']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setDebitKind(k)} className="rounded-md px-3 py-1.5" style={{ backgroundColor: debitKind === k ? '#FFFFFF' : 'transparent' }}>
              <Text className="text-[12.5px] font-semibold" style={{ color: debitKind === k ? '#1D4ED8' : '#6B7280' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {debitKind === 'expense' ? (
          <View style={{ zIndex: 5 }}>
            <SuggestInput
              value={head}
              onChangeText={setHead}
              options={headOptions}
              onSelectOption={(o) => setHead(o.label)}
              placeholder="Expense head, e.g. Salary Expenses"
              accent="#DC2626"
              inputClassName={INPUT}
              showWhenEmpty
            />
            <Text className="mt-1 text-[12px] text-gray-500">Charged as an expense, owed to the credit person below. No cash or bank account is touched.</Text>
          </View>
        ) : (
          <PartyMoveField
            label="Person (Debit)"
            ownerId={ownerId}
            partyId={to?.id ?? ''}
            pickedName={to?.name}
            onPick={setTo}
            hint="Owes you more - or you owe them less - by this amount."
            pickerTitle="Debit which person?"
          />
        )}
      </View>
      <PartyMoveField
        label="Credit"
        ownerId={ownerId}
        partyId={from?.id ?? ''}
        pickedName={from?.name}
        onPick={setFrom}
        hint="Owes you less - or you owe them more - by this amount."
        pickerTitle="Credit which person?"
      />
      <FieldRow>
        <Field label="Remarks" basis={260}>
          <TextInput
            value={narration}
            onChangeText={setNarration}
            placeholder="Optional"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
      </FieldRow>
      <FormActions onCancel={onDone} onSave={handleSave} saving={saving} saveLabel="Post voucher" />
    </>
  );
}
