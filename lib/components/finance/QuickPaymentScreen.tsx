// lib/components/finance/QuickPaymentScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from '../../hooks/useSupabase';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { usePhoneContacts } from '../../hooks/usePhoneContacts';
import { useScanBill } from '../../hooks/useScanBill';
import { BankAccountPickerModal } from './BankAccountPickerModal';
import { ContactPickerModal } from '../ContactPickerModal';
import { DateField } from '../DateTimeFields';
import { FormSection } from './FormSection';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { toBsLabel } from '../../utils/nepaliDate';
import type { Customer } from '../../../types/database.types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function QuickPaymentScreen() {
  // voice* params arrive from the Finance dashboard's voice-command button,
  // routed here the same way a Shortcuts tap is (?type=in/out) - applied
  // once on mount below, same "review before save" rule as Scan Bill.
  const { type, voiceAmount, voiceParty, voiceDate, voiceNote } = useLocalSearchParams<{
    type?: string;
    voiceAmount?: string;
    voiceParty?: string;
    voiceDate?: string;
    voiceNote?: string;
  }>();
  const isOut = type === 'out';
  const userId = useAuthStore((state) => state.session?.user.id);
  // Customers and vendors share one contacts list, but they're opposite
  // ledgers (see PartyBalancesScreen) - a Payment Out settling a Purchase
  // must reduce vendor_ledger_entries (what you owe), never
  // customer_ledger_entries (what a customer owes you), or it inflates "To
  // Receive" for someone you only ever bought from. This used to be a
  // manual Customer/Vendor toggle, but Payment Out is a vendor payment and
  // Payment In is a customer payment in every real case that comes through
  // here, so it's just the fixed direction now instead of an extra choice.
  const payTarget: 'customer' | 'vendor' = isOut ? 'vendor' : 'customer';
  const targetTable = payTarget === 'vendor' ? 'vendor_ledger_entries' : 'customer_ledger_entries';
  const entryType: 'debit' | 'credit' =
    payTarget === 'customer' ? (isOut ? 'debit' : 'credit') : isOut ? 'credit' : 'debit';
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  // Same-direction, same-target manual entries only - counts Payment In
  // separately from Payment Out (and vendor separately from customer), and
  // skips booking-synced credits (job payments), which never carry a
  // receipt_no of their own.
  const { data: sameDirectionEntries } = useSupabaseQuery(targetTable, {
    filters: userId ? { owner_id: userId, entry_type: entryType, source: 'manual' } : {},
    enabled: !!userId,
  });
  const insertEntry = useSupabaseInsert(targetTable);
  const createCustomer = useSupabaseInsert('customers');
  const updateCustomer = useSupabaseUpdate('customers');
  const bankAccounts = useBankAccounts(userId);
  const phoneContacts = usePhoneContacts();
  const { scanning, pickAndScan } = useScanBill();

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // Pre-fills the customer picker's search box with whatever name Scan Bill
  // read off the slip - still needs a tap to confirm, same reasoning as the
  // Sale/Purchase/Expense form's version of this.
  const [pickerQuery, setPickerQuery] = useState('');
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
  // more. Entries saved before this auto-numbering existed have no
  // receipt_no at all, so falling back to "how many entries are there"
  // when none of them parse keeps the count moving forward instead of
  // resetting to 1 forever just because the earliest ones weren't numbered.
  const nextReceiptNo = useMemo(() => {
    const entries = sameDirectionEntries ?? [];
    const nums = entries
      .map((e) => Number((e.receipt_no ?? '').replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : entries.length) + 1;
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
        [payTarget === 'vendor' ? 'vendor_id' : 'customer_id']: customer.id,
        owner_id: userId,
        entry_type: entryType,
        amount: value,
        note: note.trim() || null,
        source: 'manual',
        bank_account_id: bankAccountId,
        entry_date: date || null,
        receipt_no: receiptNo.trim() || null,
      } as any);
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

  // Applies whatever the voice-command button understood - same "review
  // before save" rule as Scan Bill below: this only fills fields, the party
  // still needs a tap to confirm via the picker it opens, and nothing here
  // saves on its own. Depends on the actual param values (not just "on
  // mount") because Expo Router doesn't always have them hydrated on the
  // very first render of a freshly-pushed route; a `[]` effect would fire
  // once while they were still undefined and never get another chance.
  useEffect(() => {
    if (!voiceAmount && !voiceParty && !voiceDate && !voiceNote) return;
    if (voiceAmount) setAmount(voiceAmount);
    if (voiceDate) setDate(voiceDate);
    if (voiceNote) setNote(voiceNote);
    if (voiceParty) {
      setPickerQuery(voiceParty);
      setShowPicker(true);
    }
  }, [voiceAmount, voiceParty, voiceDate, voiceNote]);

  async function handleScan() {
    phoneContacts.request();
    const scanned = await pickAndScan();
    if (!scanned) return;
    if (scanned.amount) setAmount(String(scanned.amount));
    if (scanned.date) setDate(scanned.date);
    if (scanned.note) setNote(scanned.note);
    if (scanned.vendor_name) {
      setPickerQuery(scanned.vendor_name);
      setShowPicker(true);
    }
  }

  const meta = isOut
    ? { label: 'Payment Out', color: '#DC2626', gradient: ['#DC2626', '#B91C1C'] as const, bg: 'bg-red-50', icon: 'arrow-up-circle' as const }
    : { label: 'Payment In', color: '#059669', gradient: ['#059669', '#047857'] as const, bg: 'bg-emerald-50', icon: 'arrow-down-circle' as const };

  const scanBillButton = (
    <Pressable
      onPress={handleScan}
      disabled={scanning}
      className="flex-row items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-50 px-4 py-2.5 disabled:opacity-50"
    >
      <Ionicons name={scanning ? 'hourglass-outline' : 'camera-outline'} size={16} color="#2563EB" />
      <Text className="text-sm font-semibold text-blue-700">{scanning ? 'Reading the slip…' : 'Scan Bill'}</Text>
    </Pressable>
  );

  const customerSection = (
    <FormSection icon="person-outline" title={payTarget === 'vendor' ? 'Vendor' : 'Customer'} first>
      <View className="mb-1 flex-row items-center gap-2">
        <Pressable
          onPress={() => {
            phoneContacts.request();
            setPickerQuery('');
            setShowPicker(true);
          }}
          className="flex-1 flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5"
        >
          <Text className={`flex-1 text-sm ${customerName ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
            {customerName ||
              (payTarget === 'vendor'
                ? isOut
                  ? 'Which vendor are you paying?'
                  : 'Which vendor is this refund from?'
                : isOut
                  ? 'Who are you paying?'
                  : 'Who is this payment from?')}
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
          <Text className="flex-1 text-xs font-medium text-blue-700">
            Using saved {payTarget === 'vendor' ? 'vendor' : 'customer'}
          </Text>
        </View>
      ) : (
        <Text className="text-[11px] text-gray-400">Tap to search your saved customers and phone contacts.</Text>
      )}
    </FormSection>
  );

  const paymentMethodSection = (
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
  );

  const pickerModals = (
    <>
      <ContactPickerModal
        visible={showPicker}
        initialQuery={pickerQuery}
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
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View className="px-8 pt-6">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className="text-2xl font-bold" style={{ color: meta.color }}>
              {meta.label}
            </Text>
            {scanBillButton}
          </View>

          <View className="flex-row" style={{ gap: 24 }}>
            <View className="flex-1" style={{ minWidth: 0, maxWidth: 640 }}>
              <View className="rounded-2xl border border-gray-200 bg-white p-5">
                {customerSection}

                <FormSection icon="document-text-outline" title="Details">
                  <View className="mb-3 flex-row gap-3">
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
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    className="mb-3 rounded-lg border border-gray-300 px-4 py-3 text-2xl font-bold text-gray-900"
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

                {paymentMethodSection}
              </View>
            </View>

            <View style={{ width: 320 }}>
              <LinearGradient
                colors={meta.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  shadowColor: meta.color,
                  shadowOpacity: 0.3,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 5,
                }}
              >
                <Text className="text-xs font-bold uppercase text-white/70" style={{ letterSpacing: 0.5 }}>
                  {isOut ? 'Paying out' : 'Receiving'}
                </Text>
                <Text className="mt-1 text-4xl font-extrabold text-white" numberOfLines={1}>
                  NPR {(Number(amount) || 0).toLocaleString()}
                </Text>

                <View className="mt-5" style={{ gap: 10 }}>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="person-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text className="flex-1 text-sm text-white/90" numberOfLines={1}>
                      {customerName || `No ${payTarget} selected`}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text className="text-sm text-white/90">{toBsLabel(date)}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name={bankAccountId ? 'business-outline' : 'cash-outline'} size={14} color="rgba(255,255,255,0.85)" />
                    <Text className="text-sm text-white/90">{selectedAccountName}</Text>
                  </View>
                  {!!note && (
                    <View className="flex-row items-start gap-2">
                      <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.85)" />
                      <Text className="flex-1 text-sm text-white/90" numberOfLines={2}>
                        {note}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="mt-4 items-center rounded-xl py-3.5 disabled:opacity-50"
                style={{ backgroundColor: meta.color }}
              >
                <Text className="text-base font-bold text-white">
                  {saving ? 'Saving…' : isOut ? 'Record payment out' : 'Record payment in'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {pickerModals}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-gray-50 px-6 pt-4"
      contentContainerStyle={{ paddingBottom: 40 }}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
    >
      <View className={`mb-3 flex-row items-center gap-2 rounded-2xl p-4 ${meta.bg}`}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
        <Text className="text-base font-bold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
      </View>

      <View className="mb-3">{scanBillButton}</View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        {customerSection}

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

        {paymentMethodSection}

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

      {pickerModals}
    </KeyboardAwareScrollView>
  );
}
