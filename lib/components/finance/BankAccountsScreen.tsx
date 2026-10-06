// lib/components/finance/BankAccountsScreen.tsx
import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useBankAccounts, type BankAccountDetails } from '../../hooks/useBankAccounts';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { BookPage, BookTable, ToolbarButton, useBarActions, useBookLayout, type BookColumn } from './BookKit';
import { FINANCE_ENTRY_ACCENT, FINANCE_ENTRY_SHADOW } from './entryTheme';
import type { BankAccount } from '../../../types/database.types';

const EMPTY_DETAILS: BankAccountDetails = { name: '', bank_name: null, account_number: null, account_holder_name: null, address: null };

function toDetails(acc: BankAccount): BankAccountDetails {
  return {
    name: acc.name,
    bank_name: acc.bank_name,
    account_number: acc.account_number,
    account_holder_name: acc.account_holder_name,
    address: acc.address,
  };
}

const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900';

/** A label over its input. Fields sit side by side and wrap onto the next line
 * when the window is narrow, so the same form fits a desktop and a phone. */
function Field({ label, basis = 220, children }: { label: string; basis?: number; children: ReactNode }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: basis, minWidth: 0 }}>
      <Text className="mb-1.5 text-xs font-semibold text-gray-600">{label}</Text>
      {children}
    </View>
  );
}

/** Full add/edit form for one bank account - a label alone used to be all
 * you could give it, which isn't enough to actually identify the account
 * for real bookkeeping (which bank, whose name it's under, the account
 * number). Shared between "add new" and editing an existing row. */
function AccountForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: BankAccountDetails;
  onSave: (details: BankAccountDetails) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [details, setDetails] = useState<BankAccountDetails>(initial ?? EMPTY_DETAILS);
  const [saving, setSaving] = useState(false);

  function setField(key: keyof BankAccountDetails, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    if (!details.name.trim()) {
      showAlert('Add a label', 'Give this account a short label, e.g. "Nabil Bank - Current".');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: details.name.trim(),
        bank_name: details.bank_name?.trim() || null,
        account_number: details.account_number?.trim() || null,
        account_holder_name: details.account_holder_name?.trim() || null,
        address: details.address?.trim() || null,
      });
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      className="rounded-2xl border border-gray-200 bg-white px-5 py-4"
      style={{ boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.03)' }}
    >
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="business-outline" size={14} color="#6B7280" />
        <Text className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {initial ? 'Edit bank account' : 'New bank account'}
        </Text>
      </View>

      <View className="flex-row flex-wrap" style={{ columnGap: 14, rowGap: 12 }}>
        <Field label="Label">
          <TextInput
            value={details.name}
            onChangeText={(v) => setField('name', v)}
            placeholder="e.g. Nabil Bank - Current"
            placeholderTextColor="#9CA3AF"
            autoFocus={!initial}
            className={INPUT}
          />
        </Field>
        <Field label="Bank name">
          <TextInput
            value={details.bank_name ?? ''}
            onChangeText={(v) => setField('bank_name', v)}
            placeholder="e.g. Nabil Bank"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
        <Field label="Account number">
          <TextInput
            value={details.account_number ?? ''}
            onChangeText={(v) => setField('account_number', v)}
            placeholder="e.g. 01234567890123"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            className={INPUT}
          />
        </Field>
        <Field label="Account holder name">
          <TextInput
            value={details.account_holder_name ?? ''}
            onChangeText={(v) => setField('account_holder_name', v)}
            placeholder="e.g. Sagar Rayamajhi"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
        <Field label="Branch / Address" basis={300}>
          <TextInput
            value={details.address ?? ''}
            onChangeText={(v) => setField('address', v)}
            placeholder="e.g. New Road Branch, Kathmandu"
            placeholderTextColor="#9CA3AF"
            className={INPUT}
          />
        </Field>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center justify-end" style={{ gap: 10 }}>
        {onDelete && (
          <Pressable
            onPress={() =>
              showAlert('Remove this bank account?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: onDelete },
              ])
            }
            className="mr-auto flex-row items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5"
            style={{ gap: 6 }}
          >
            <Ionicons name="trash-outline" size={15} color="#DC2626" />
            <Text className="text-sm font-semibold text-red-600">Remove</Text>
          </Pressable>
        )}
        <Pressable onPress={onCancel} className="items-center rounded-xl border border-gray-300 bg-white px-6 py-2.5">
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="items-center rounded-xl px-8 py-2.5 disabled:opacity-50"
          style={{ backgroundColor: FINANCE_ENTRY_ACCENT, boxShadow: `0 2px 6px ${FINANCE_ENTRY_SHADOW}` }}
        >
          <Text className="text-sm font-bold text-white">{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A table row: a bank account, or null for Cash, which is always there. */
type Row = { id: string; acc: BankAccount | null };

const dash = <Text className="text-[12.5px] text-gray-400">—</Text>;
const cellText = (value: string | null | undefined) =>
  value ? (
    <Text className="text-[12.5px] text-gray-700" numberOfLines={1}>
      {value}
    </Text>
  ) : (
    dash
  );

export function BankAccountsScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { accounts, create, update, remove } = useBankAccounts(userId);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // The name, the back button (phones) and "Add account" live in the top bar.
  const layout = useBookLayout();
  useBarActions(
    {
      wide: layout.wide,
      right: showAdd
        ? undefined
        : () => (
            <ToolbarButton
              icon="add"
              label={layout.wide ? 'Add account' : 'Add'}
              onPress={() => {
                setEditingId(null);
                setShowAdd(true);
              }}
            />
          ),
    },
    [showAdd]
  );

  const openEdit = (id: string) => {
    setShowAdd(false);
    setEditingId(id);
  };

  const addForm = showAdd && (
    <AccountForm
      key="new"
      onSave={async (details) => {
        await create(details);
        setShowAdd(false);
      }}
      onCancel={() => setShowAdd(false)}
    />
  );
  const editForm = (acc: BankAccount) => (
    <AccountForm
      key={acc.id}
      initial={toDetails(acc)}
      onSave={async (details) => {
        await update(acc.id, details);
        setEditingId(null);
      }}
      onCancel={() => setEditingId(null)}
      onDelete={async () => {
        await remove(acc.id);
        setEditingId(null);
      }}
    />
  );

  const footnote = (
    <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
      Tap an account to edit or remove it. Every account here shows up beside Cash when you record a payment or an
      expense, and its balance counts toward Available Balance.
    </Text>
  );

  // Web: the same cash-book look as the Day Book and the Ledger - one bordered
  // table, the form as a compact card above it. Phones keep the card list below.
  if (Platform.OS === 'web') {
    const rows: Row[] = [{ id: 'cash', acc: null }, ...accounts.map((acc) => ({ id: acc.id, acc }))];

    const account = (row: Row, withDetails: boolean) => {
      if (!row.acc) {
        return (
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
            <View>
              <Text className="text-[13px] font-semibold text-gray-900">Cash</Text>
              <Text className="text-[11px] text-gray-400">Always available</Text>
            </View>
          </View>
        );
      }
      const sub = withDetails ? [row.acc.bank_name, row.acc.account_number ? `A/C ${row.acc.account_number}` : null].filter(Boolean).join(' · ') : '';
      return (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Ionicons name="business-outline" size={16} color="#2563EB" />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text className="text-[13px] font-semibold text-gray-900" numberOfLines={1}>
              {row.acc.name}
            </Text>
            {!!sub && (
              <Text className="text-[11px] text-gray-400" numberOfLines={1}>
                {sub}
              </Text>
            )}
          </View>
        </View>
      );
    };

    const action: BookColumn<Row> = {
      key: 'edit',
      label: '',
      width: 44,
      align: 'right',
      render: (row) => (row.acc ? <Ionicons name="pencil-outline" size={16} color="#9CA3AF" /> : null),
    };

    const columns: BookColumn<Row>[] = layout.full
      ? [
          { key: 'account', label: 'Account', render: (row) => account(row, false) },
          { key: 'bank', label: 'Bank', width: 160, render: (row) => (row.acc ? cellText(row.acc.bank_name) : dash) },
          { key: 'number', label: 'Account number', width: 170, render: (row) => (row.acc ? cellText(row.acc.account_number) : dash) },
          { key: 'holder', label: 'Account holder', width: 170, render: (row) => (row.acc ? cellText(row.acc.account_holder_name) : dash) },
          { key: 'address', label: 'Branch / Address', width: 200, render: (row) => (row.acc ? cellText(row.acc.address) : dash) },
          action,
        ]
      : [{ key: 'account', label: 'Account', render: (row) => account(row, true) }, action];

    return (
      <BookPage wide={layout.wide}>
        {addForm}

        <BookTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowPress={(row) => row.acc && openEdit(row.acc.id)}
          highlight={(row) => row.id === editingId}
          expanded={(row) =>
            row.acc && row.id === editingId ? (
              <View className="border-b border-gray-200 bg-gray-50 p-3">{editForm(row.acc)}</View>
            ) : null
          }
        />

        {accounts.length === 0 && !showAdd && (
          <Text className="px-1 text-[13px] text-gray-500">No bank accounts yet - add one with Add account.</Text>
        )}

        {footnote}
      </BookPage>
    );
  }

  return (
    <BookPage wide={false}>
      {addForm}

      <View>
        <View className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
          </View>
          <Text className="flex-1 text-sm font-semibold text-gray-900">Cash</Text>
          <Text className="text-xs text-gray-400">Always available</Text>
        </View>

        {accounts.length === 0 && !showAdd ? (
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name="business-outline" size={28} color="#D1D5DB" />
            <Text className="mt-2 text-gray-500">No bank accounts yet — add one above.</Text>
          </View>
        ) : (
          accounts.map((acc) =>
            editingId === acc.id ? (
              <View key={acc.id} className="mb-2.5">
                {editForm(acc)}
              </View>
            ) : (
              <Pressable
                key={acc.id}
                onPress={() => openEdit(acc.id)}
                className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                  <Ionicons name="business-outline" size={16} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{acc.name}</Text>
                  {!!acc.account_number && <Text className="text-xs text-gray-400">A/C {acc.account_number}</Text>}
                </View>
                <Ionicons name="pencil-outline" size={17} color="#9CA3AF" />
              </Pressable>
            )
          )
        )}
      </View>

      {footnote}
    </BookPage>
  );
}
