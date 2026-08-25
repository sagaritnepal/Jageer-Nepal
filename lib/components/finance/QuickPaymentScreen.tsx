// lib/components/finance/QuickPaymentScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from '../../hooks/useSupabase';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { usePhoneContacts } from '../../hooks/usePhoneContacts';
import { BankAccountPickerModal } from './BankAccountPickerModal';
import { ContactPickerModal } from '../ContactPickerModal';
import { DateField } from '../DateTimeFields';
import { FormSection } from './FormSection';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { Customer } from '../../../types/database.types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function QuickPaymentScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isOut = type === 'out';
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  // Same-direction manual entries only - counts Payment In separately from
  // Payment Out, and skips booking-synced credits (job payments), which
  // never carry a receipt_no of their own.
  const { data: sameDirectionEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId, entry_type: isOut ? 'debit' : 'credit', source: 'manual' } : {},
    enabled: !!userId,
  });
  const insertEntry = useSupabaseInsert('customer_ledger_entries');
  const createCustomer = useSupabaseInsert('customers');
  const updateCustomer = useSupabaseUpdate('customers');
  const bankAccounts = useBankAccounts(userId);
  const phoneContacts = usePhoneContacts();

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // Lets a typo in a just-added (or existing) customer's name get fixed
  // right here instead of hunting it down in Customers afterward.
  const [showRenameCustomer, setShowRenameCustomer] = useState(false);
  const [renameCustomerValue, setRenameCustomerValue] = useState('');
  const [renamingCustomer, setRenamingCustomer] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [receiptNo, setReceiptNo] = useState('');
  // Only true once the reseller has actually typed in the field - lets the
  // auto-filled next number keep updating (e.g. once real data loads in) up
  // until they've made it their own, without ever overwriting an edit.
  const [receiptNoTouched, setReceiptNoTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedAccountName = bankAccountId
    ? bankAccounts.accounts.find((a) => a.id === bankAccountId)?.name ?? 'Cash'
    : 'Cash';

  // 001, 002, 003... ascending off the highest number already used in this
  // direction - padded to 3 digits until there are enough entries to need
  // more.
  const nextReceiptNo = useMemo(() => {
    const nums = (sameDirectionEntries ?? [])
      .map((e) => Number((e.receipt_no ?? '').replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(3, '0');
  }, [sameDirectionEntries]);

  useEffect(() => {
    if (!receiptNoTouched) setReceiptNo(nextReceiptNo);
  }, [nextReceiptNo, receiptNoTouched]);

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setShowPicker(false);
  }

  // Picking a phone contact not already saved (or typing a brand new name
  // in the popup's own search box) saves them now - payments must link to
  // a real customer_id, so this shouldn't mean a trip to Your Customers
  // first. If the phone number already matches someone saved, use that
  // record instead of creating an unlinked duplicate.
  async function handleSelectNew(name: string, phone: string | null) {
    if (!userId) return;
    setShowPicker(false);
    if (phone) {
      const existing = (customers ?? []).find((c) => c.phone === phone);
      if (existing) {
        selectCustomer(existing);
        return;
      }
    }
    try {
      const created = await createCustomer.mutateAsync({ owner_id: userId, name, phone });
      selectCustomer(created);
    } catch (err) {
      showAlert('Could not add customer', getErrorMessage(err));
    }
  }

  async function handleRenameCustomer() {
    if (!selectedCustomer || !renameCustomerValue.trim()) return;
    setRenamingCustomer(true);
    try {
      await updateCustomer.mutateAsync({ id: selectedCustomer.id, values: { name: renameCustomerValue.trim() } });
      setCustomerName(renameCustomerValue.trim());
      setSelectedCustomer({ ...selectedCustomer, name: renameCustomerValue.trim() });
      setShowRenameCustomer(false);
    } catch (err) {
      showAlert('Could not rename', getErrorMessage(err));
    } finally {
      setRenamingCustomer(false);
    }
  }

  async function handleSave() {
    if (!userId) return;
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showAlert('Add a customer', 'Tap the field to search or add a customer for this payment.');
      return;
    }
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      showAlert('Enter an amount', 'Add a valid amount in NPR.');
      return;
    }
    setSaving(true);
    try {
      // Typed a name that doesn't match anyone picked/selected above - save
      // them as a new customer on the spot rather than making this a dead
      // end that sends the reseller off to Your Customers first.
      const customer = selectedCustomer ?? (await createCustomer.mutateAsync({ owner_id: userId, name: trimmedName, phone: null }));
      await insertEntry.mutateAsync({
        customer_id: customer.id,
        owner_id: userId,
        entry_type: isOut ? 'debit' : 'credit',
        amount: value,
        note: note.trim() || null,
        source: 'manual',
        bank_account_id: bankAccountId,
        entry_date: date || null,
        receipt_no: receiptNo.trim() || null,
      });
      showAlert(
        isOut ? 'Payment out recorded' : 'Payment in recorded',
        `NPR ${value.toLocaleString()} for ${customer.name}.`
      );
      setAmount('');
      setNote('');
      setSelectedCustomer(null);
      setCustomerName('');
      setBankAccountId(null);
      setDate(todayIso());
      setReceiptNoTouched(false);
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const meta = isOut
    ? { label: 'Payment Out', color: '#DC2626', bg: 'bg-red-50', icon: 'arrow-up-circle' as const }
    : { label: 'Payment In', color: '#059669', bg: 'bg-emerald-50', icon: 'arrow-down-circle' as const };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-gray-50 px-6 pt-4"
      contentContainerStyle={{ paddingBottom: 40 }}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
    >
      <View className={`mb-4 flex-row items-center gap-2 rounded-2xl p-4 ${meta.bg}`}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
        <Text className="text-base font-bold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <FormSection icon="person-outline" title="Customer" first>
          <View className="mb-1 flex-row items-center gap-2">
            <Pressable
              onPress={() => {
                phoneContacts.request();
                setShowPicker(true);
              }}
              className="flex-1 flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5"
            >
              <Text className={`flex-1 text-sm ${customerName ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
                {customerName || (isOut ? 'Who are you paying?' : 'Who is this payment from?')}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </Pressable>
            {!!selectedCustomer && (
              <Pressable
                onPress={() => {
                  setRenameCustomerValue(selectedCustomer.name);
                  setShowRenameCustomer(true);
                }}
                hitSlop={8}
                className="rounded-lg border border-gray-300 bg-white p-2.5"
              >
                <Ionicons name="pencil-outline" size={16} color="#6B7280" />
              </Pressable>
            )}
          </View>
          {showRenameCustomer && (
            <View className="mb-1 flex-row items-center gap-2">
              <TextInput
                value={renameCustomerValue}
                onChangeText={setRenameCustomerValue}
                autoFocus
                placeholder="Name"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <Pressable onPress={handleRenameCustomer} disabled={renamingCustomer} hitSlop={8}>
                <Ionicons name="checkmark-circle" size={22} color="#059669" />
              </Pressable>
              <Pressable onPress={() => setShowRenameCustomer(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </Pressable>
            </View>
          )}
          {selectedCustomer ? (
            <View className="flex-row items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2">
              <Ionicons name="checkmark-circle" size={14} color="#1d4ed8" />
              <Text className="flex-1 text-xs font-medium text-blue-700">Using saved customer</Text>
            </View>
          ) : (
            <Text className="text-[11px] text-gray-400">Tap to search your saved customers and phone contacts.</Text>
          )}
        </FormSection>

        <FormSection icon="document-text-outline" title="Details">
          <View className="mb-3 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">Date</Text>
              <DateField value={date} onChange={setDate} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-medium text-gray-500">{isOut ? 'Payment No.' : 'Receipt No.'}</Text>
              <TextInput
                value={receiptNo}
                onChangeText={(v) => {
                  setReceiptNo(v);
                  setReceiptNoTouched(true);
                }}
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                className="rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900"
              />
            </View>
          </View>

          <Text className="mb-1 text-xs font-medium text-gray-500">
            {isOut ? 'Amount paid out (NPR)' : 'Amount received (NPR)'}
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />

          <Text className="mb-1 text-xs font-medium text-gray-500">Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Cash payment"
            placeholderTextColor="#9CA3AF"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
          />
        </FormSection>

        <FormSection icon="wallet-outline" title="Payment method">
          <Pressable
            onPress={() => setShowAccountPicker(true)}
            className="flex-row items-center justify-between rounded-lg border border-gray-300 px-3 py-2.5"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name={bankAccountId ? 'business-outline' : 'cash-outline'} size={16} color="#6B7280" />
              <Text className="text-sm text-gray-900">{selectedAccountName}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
        </FormSection>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="items-center rounded-lg py-3 disabled:opacity-50"
          style={{ backgroundColor: meta.color }}
        >
          <Text className="text-base font-semibold text-white">
            {saving ? 'Saving…' : isOut ? 'Record payment out' : 'Record payment in'}
          </Text>
        </Pressable>
      </View>

      <ContactPickerModal
        visible={showPicker}
        initialQuery=""
        customers={customers ?? []}
        phoneContacts={phoneContacts.contacts}
        onSelectCustomer={selectCustomer}
        onSelectNew={handleSelectNew}
        onClose={() => setShowPicker(false)}
      />
      <BankAccountPickerModal
        visible={showAccountPicker}
        accounts={bankAccounts.accounts}
        selectedId={bankAccountId}
        onSelect={setBankAccountId}
        onClose={() => setShowAccountPicker(false)}
        onRename={bankAccounts.rename}
        onDelete={bankAccounts.remove}
      />
    </KeyboardAwareScrollView>
  );
}
