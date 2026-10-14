// lib/components/finance/JournalVoucherForm.tsx
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
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

  async function handleSave() {
    const value = Number(amount);
    if (!from || !to) {
      showAlert('Pick both people', 'A journal voucher moves an amount from one person to another.');
      return;
    }
    if (from.id === to.id) {
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
      // Debited: on their vendor ledger when that is the only ledger they have, else on their customer ledger.
      const [toVendor, toCustomer] = await Promise.all([
        hasEntries('vendor_ledger_entries', 'vendor_id', to.id),
        hasEntries('customer_ledger_entries', 'customer_id', to.id),
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
          ? { ...common, vendor_id: to.id, entry_type: 'credit' }
          : { ...common, customer_id: to.id, entry_type: 'debit' }
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
      <PartyMoveField
        label="From (Credit)"
        ownerId={ownerId}
        partyId={from?.id ?? ''}
        pickedName={from?.name}
        onPick={setFrom}
        hint="Owes you less - or you owe them more - by this amount."
        pickerTitle="Credit which person?"
      />
      <PartyMoveField
        label="To (Debit)"
        ownerId={ownerId}
        partyId={to?.id ?? ''}
        pickedName={to?.name}
        onPick={setTo}
        hint="Owes you more - or you owe them less - by this amount."
        pickerTitle="Debit which person?"
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
