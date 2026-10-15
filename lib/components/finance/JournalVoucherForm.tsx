// lib/components/finance/JournalVoucherForm.tsx
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { DateField } from '../DateTimeFields';
import { Field, FieldRow, FormActions, INPUT } from './FormKit';
import { PartyMoveField } from './EntryEditParts';
import { SuggestInput } from './SuggestInput';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { localTodayIso } from '../../utils/localDate';
import { journalNote, newJournalCode } from '../../utils/journalVoucher';

type Person = { id: string; name: string };
type Side = 'debit' | 'credit';
type Line = { key: number; side: Side; kind: 'party' | 'expense'; person: Person | null; head: string; amount: string };

let lineSeq = 0;
const newLine = (side: Side): Line => ({ key: (lineSeq += 1), side, kind: 'party', person: null, head: '', amount: '' });

/** Whether a person has any entry on one of the two ledgers. */
async function hasEntries(table: 'customer_ledger_entries' | 'vendor_ledger_entries', column: 'customer_id' | 'vendor_id', id: string) {
  const { count, error } = await (supabase.from(table) as any).select('id', { count: 'exact', head: true }).eq(column, id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

const money = (n: number) => `NPR ${Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString() : (Math.round(n * 100) / 100).toLocaleString()}`;

/** The Journal voucher form: any number of Debit lines and Credit lines that add up to the same total.
 * A line is a person's ledger (either side) or an expense head (debit only, e.g. Salary Expenses
 * debited, Roshan and Manish credited). No cash or bank account is touched - see journalVoucher.ts:
 * every line carries the voucher's code in its remark, which is how the lines are found again. */
export function JournalVoucherForm({ ownerId, onDone }: { ownerId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<Line[]>(() => [newLine('debit'), newLine('credit')]);
  const [date, setDate] = useState(localTodayIso());
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: categories } = useSupabaseQuery('expense_categories', {
    filters: { owner_id: ownerId },
    orderBy: { column: 'name' },
  });

  const patch = (key: number, values: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...values } : l)));
  const remove = (key: number) => setLines((ls) => (ls.length > 2 ? ls.filter((l) => l.key !== key) : ls));
  const total = (side: Side) => lines.filter((l) => l.side === side).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const debit = total('debit');
  const credit = total('credit');
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005;

  const headOptions = (text: string) => {
    const q = text.trim().toLowerCase();
    return (categories ?? [])
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 12)
      .map((c) => ({ key: c.id, label: c.name }));
  };

  async function handleSave() {
    if (!date) {
      showAlert('Pick a date', 'Choose the date of this voucher.');
      return;
    }
    for (const [i, l] of lines.entries()) {
      const where = `${l.side === 'debit' ? 'Debit' : 'Credit'} line ${i + 1}`;
      if (l.kind === 'party' ? !l.person : !l.head.trim()) {
        showAlert('Finish every line', `${where}: ${l.kind === 'party' ? 'pick the person' : 'choose the expense head'}.`);
        return;
      }
      const v = Number(l.amount);
      if (!l.amount.trim() || Number.isNaN(v) || v <= 0) {
        showAlert('Enter an amount', `${where}: add a valid amount in NPR.`);
        return;
      }
    }
    if (!lines.some((l) => l.side === 'debit') || !lines.some((l) => l.side === 'credit')) {
      showAlert('Add both sides', 'A voucher needs at least one Debit and one Credit line.');
      return;
    }
    if (!balanced) {
      showAlert('Debit and credit differ', `Debit ${money(debit)} and Credit ${money(credit)} must be equal - the difference is ${money(Math.abs(debit - credit))}.`);
      return;
    }
    setSaving(true);
    const made: { table: string; id: string }[] = [];
    try {
      const note = journalNote(newJournalCode(), narration);
      const common = { owner_id: ownerId, note, source: 'manual', entry_date: date, bank_account_id: null };
      const created = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));

      for (const l of lines) {
        const amount = Number(l.amount);
        let table: string;
        let row: Record<string, unknown>;
        if (l.kind === 'expense') {
          const name = l.head.trim();
          let categoryId = created.get(name.toLowerCase()) ?? null;
          if (!categoryId) {
            const c = await (supabase.from('expense_categories') as any).insert({ owner_id: ownerId, name }).select('id').single();
            if (c.error) throw c.error;
            categoryId = c.data.id as string;
            created.set(name.toLowerCase(), categoryId);
          }
          table = 'business_transactions';
          row = {
            owner_id: ownerId,
            type: 'expense',
            amount,
            party_name: name,
            note,
            bill_date: date,
            expense_category_id: categoryId,
            payment_mode: 'credit',
            bank_account_id: null,
          };
        } else {
          const person = l.person as Person;
          // A debited person who only has a vendor ledger is debited there (a payment on it); everyone else on
          // their customer ledger.
          let vendorOnly = false;
          if (l.side === 'debit') {
            const [v, c] = await Promise.all([
              hasEntries('vendor_ledger_entries', 'vendor_id', person.id),
              hasEntries('customer_ledger_entries', 'customer_id', person.id),
            ]);
            vendorOnly = v && !c;
          }
          if (vendorOnly) {
            table = 'vendor_ledger_entries';
            row = { ...common, amount, vendor_id: person.id, entry_type: 'credit' };
          } else {
            table = 'customer_ledger_entries';
            row = { ...common, amount, customer_id: person.id, entry_type: l.side };
          }
        }
        const res = await (supabase.from(table) as any).insert(row).select('id').single();
        if (res.error) throw res.error;
        made.push({ table, id: res.data.id as string });
      }
      await Promise.all(
        ['customer_ledger_entries', 'vendor_ledger_entries', 'business_transactions', 'expense_categories'].map((t) =>
          queryClient.invalidateQueries({ queryKey: [t] })
        )
      );
      onDone();
    } catch (err) {
      // Take back what was already posted, so a voucher is never part of one.
      for (const m of made) await (supabase.from(m.table) as any).delete().eq('id', m.id);
      showAlert('Could not save the voucher', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const sideLines = (side: Side) => lines.filter((l) => l.side === side);

  const renderLine = (l: Line, n: number) => (
    <View key={l.key} className="rounded-xl border border-gray-200 bg-white p-3" style={{ gap: 8 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-[12px] font-bold text-gray-500">{l.side === 'debit' ? 'Debit' : 'Credit'} {n}</Text>
        {l.side === 'debit' && (
          <View className="flex-row rounded-lg bg-gray-100 p-0.5">
            {([['party', 'Person'], ['expense', 'Expense head']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => patch(l.key, { kind: k })} className="rounded-md px-2.5 py-1" style={{ backgroundColor: l.kind === k ? '#FFFFFF' : 'transparent' }}>
                <Text className="text-[12px] font-semibold" style={{ color: l.kind === k ? '#1D4ED8' : '#6B7280' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1 }} />
        {lines.length > 2 && (
          <Pressable onPress={() => remove(l.key)} hitSlop={8} accessibilityLabel="Remove this line">
            <Ionicons name="trash-outline" size={17} color="#DC2626" />
          </Pressable>
        )}
      </View>
      {l.kind === 'expense' ? (
        <View style={{ zIndex: 5 }}>
          <SuggestInput
            value={l.head}
            onChangeText={(v) => patch(l.key, { head: v })}
            options={headOptions(l.head)}
            onSelectOption={(o) => patch(l.key, { head: o.label })}
            placeholder="Expense head, e.g. Salary Expenses"
            accent="#DC2626"
            inputClassName={INPUT}
            showWhenEmpty
          />
        </View>
      ) : (
        <PartyMoveField
          label={l.side === 'debit' ? 'Person (Debit)' : 'Person (Credit)'}
          ownerId={ownerId}
          partyId={l.person?.id ?? ''}
          pickedName={l.person?.name}
          onPick={(p) => patch(l.key, { person: p })}
          hint={l.side === 'debit' ? 'Owes you more - or you owe them less.' : 'Owes you less - or you owe them more.'}
          pickerTitle={l.side === 'debit' ? 'Debit which person?' : 'Credit which person?'}
        />
      )}
      <TextInput
        value={l.amount}
        onChangeText={(v) => patch(l.key, { amount: v })}
        placeholder="Amount (NPR)"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        className={INPUT}
      />
    </View>
  );

  return (
    <>
      <FieldRow>
        <Field label="Date" basis={220}>
          <DateField value={date} onChange={setDate} />
        </Field>
      </FieldRow>
      <Text className="text-[12px] text-gray-500">
        Add as many Debit and Credit lines as you need - they must add up to the same total. No cash or bank account is touched.
      </Text>

      {(['debit', 'credit'] as const).map((side) => (
        <View key={side} style={{ gap: 8 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-[13px] font-extrabold" style={{ color: side === 'debit' ? '#B91C1C' : '#047857' }}>
              {side === 'debit' ? 'DEBIT' : 'CREDIT'}
            </Text>
            <Text className="flex-1 text-[12px] text-gray-500">{money(total(side))}</Text>
            <Pressable
              onPress={() => setLines((ls) => [...ls, newLine(side)])}
              className="flex-row items-center rounded-lg border border-gray-300 px-2.5 py-1.5"
              style={{ gap: 4 }}
            >
              <Ionicons name="add" size={15} color="#1D4ED8" />
              <Text className="text-[12.5px] font-semibold text-blue-700">Add {side}</Text>
            </Pressable>
          </View>
          {sideLines(side).map((l, i) => renderLine(l, i + 1))}
        </View>
      ))}

      <View className="flex-row items-center rounded-xl px-3 py-2.5" style={{ gap: 12, backgroundColor: balanced ? '#ECFDF5' : '#FEF2F2' }}>
        <Text className="flex-1 text-[13px] font-semibold text-gray-800">Debit {money(debit)}  ·  Credit {money(credit)}</Text>
        <Text className="text-[13px] font-bold" style={{ color: balanced ? '#047857' : '#B91C1C' }}>
          {balanced ? 'Balanced' : `Difference ${money(Math.abs(debit - credit))}`}
        </Text>
      </View>

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
