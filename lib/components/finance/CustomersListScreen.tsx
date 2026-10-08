// lib/components/finance/CustomersListScreen.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../hooks/useSupabase';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { supabase } from '../../supabase';
import { ContactPickerModal } from '../ContactPickerModal';
import { BookPage, BookStats, BookTable, Pill, ToolbarButton, money as bookMoney, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { PartyBalance } from './PartyBalance';
import { PartyTypeField } from './PartyTypeField';
import { Field, FieldRow, FormActions, INPUT, PopupCard } from './FormKit';
import { Checkbox, LEDGER_TONE, OptionMenuModal, StatusBadges, SummaryCard, type MenuOption } from './ledger/LedgerUi';
import { partyPosition, type PartyPosition } from '../../utils/partyBalance';
import {
  entryDay,
  overdueAmount,
  receivableAging,
  relativeDay,
  sideTotals,
  statusOf,
  summarize,
  type LedgerItem,
  type PartyStatus,
  type PartyTotals,
} from '../../utils/ledgerStatement';
import { exportPartiesXlsx, type PartyListRow } from '../../utils/exportLedger';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { nameCaps } from '../../utils/nameCaps';
import { isValidPhone10 } from '../../utils/phone';
import { localTodayIso } from '../../utils/localDate';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import { getLastSyncedAt, isContactsSyncEnabled, requestAndSyncPhoneContacts } from '../../utils/contactsSync';
import { pickPhoneContact } from '../../utils/pickPhoneContact';
import type { Customer, Profile } from '../../../types/database.types';

/** Every ledger entry of every party, grouped by party. A party's two ledgers
 * (customer_ledger_entries, vendor_ledger_entries - opposite polarity, see
 * 0059_vendor_ledger.sql) are shown as the one account they add up to; the
 * arithmetic is in ledgerStatement.ts. */
function useLedgerItems(userId: string | undefined): Map<string, LedgerItem[]> {
  // `all`: balances are sums over every entry, and the API cuts a plain read
  // off at 1000 rows - past that, each party's balance is silently wrong.
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });

  return useMemo(() => {
    const byParty = new Map<string, LedgerItem[]>();
    const add = (partyId: string, item: LedgerItem) => {
      const list = byParty.get(partyId);
      if (list) list.push(item);
      else byParty.set(partyId, [item]);
    };
    for (const e of customerEntries ?? []) {
      add(e.customer_id, {
        id: e.id,
        side: 'customer',
        entryType: e.entry_type,
        amount: Number(e.amount),
        day: entryDay(e.entry_date, e.created_at),
        createdAt: e.created_at,
      });
    }
    for (const e of vendorEntries ?? []) {
      add(e.vendor_id, {
        id: e.id,
        side: 'vendor',
        entryType: e.entry_type,
        amount: Number(e.amount),
        day: entryDay(e.entry_date, e.created_at),
        createdAt: e.created_at,
      });
    }
    return byParty;
  }, [customerEntries, vendorEntries]);
}

/** Id of the existing customer already using `phone` for this owner, if any. */
async function findExistingCustomerByPhone(ownerId: string, phone: string, excludeCustomerId?: string) {
  let query = supabase.from('customers').select('id').eq('owner_id', ownerId).eq('phone', phone);
  if (excludeCustomerId) query = query.neq('id', excludeCustomerId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return ((data ?? []) as { id: string }[])[0]?.id ?? null;
}

function AddCustomerForm({ userId, basePath, initialName, onDone }: { userId: string; basePath: string; initialName?: string; onDone: () => void }) {
  const createCustomer = useSupabaseInsert('customers');
  // A ledger type is required - unless there are none to choose from (the types table
  // is not set up yet), where the field is not shown at all.
  const { available: typesAvailable } = usePartyTypes(userId);
  const [name, setName] = useState(initialName ? nameCaps(initialName) : '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [partyTypeId, setPartyTypeId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUseMyLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Location permission needed', 'Allow location access to attach a position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }

  async function handlePickContact() {
    const picked = await pickPhoneContact();
    if (!picked) return;
    if (picked.name) setName(nameCaps(picked.name));
    if (picked.phone) setPhone(picked.phone);
  }

  async function handleSave() {
    // The name and the ledger type are required; the phone number and address are not
    // (a phone number, when given, has to be a real one).
    const trimmedPhone = phone.trim();
    const missing = [!name.trim() && 'Name', typesAvailable && !partyTypeId && 'Ledger type'].filter(Boolean);
    if (missing.length > 0) {
      showAlert('Fill in the required details', `Still needed: ${missing.join(', ')}.`);
      return;
    }
    if (trimmedPhone && !isValidPhone10(trimmedPhone)) {
      showAlert('Check the phone number', 'Enter a valid 10-digit phone number.');
      return;
    }
    setSaving(true);
    try {
      const existingId = trimmedPhone ? await findExistingCustomerByPhone(userId, trimmedPhone) : null;
      if (existingId) {
        // Almost always means this contact was already pulled in by the
        // background phone-contacts sync (see contactsSync.ts) before the
        // user got to it manually - a flat "already exists" refusal with no
        // way forward reads as the app just blocking them, so take them
        // straight to the record that's already there instead.
        showAlert('Already saved', 'Someone with this phone number is already in your list.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View them', onPress: () => router.push(`${basePath}/customer/${existingId}` as any) },
        ]);
        onDone();
        return;
      }
      await createCustomer.mutateAsync({
        owner_id: userId,
        name: nameCaps(name.trim()),
        phone: trimmedPhone || null,
        address: address.trim() || null,
        // Only sent when chosen: without the types table there is nothing to send.
        ...(partyTypeId ? { party_type_id: partyTypeId } : {}),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      onDone();
    } catch (err) {
      showAlert('Could not save customer', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PopupCard title="New party" onClose={onDone}>
      <FieldRow>
        <Field label="Name *" basis={240}>
          <View className="flex-row items-center rounded-lg border border-gray-300 bg-white">
            <TextInput
              value={name}
              onChangeText={(v) => setName(nameCaps(v))}
              autoCapitalize="characters"
              autoFocus
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              className="flex-1 px-3 py-2.5 text-sm text-gray-900"
            />
            {Platform.OS !== 'web' && (
              <Pressable onPress={handlePickContact} hitSlop={8} className="px-2.5">
                <Ionicons name="person-add-outline" size={18} color="#1d4ed8" />
              </Pressable>
            )}
          </View>
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

      <PartyTypeField ownerId={userId} value={partyTypeId} onChange={setPartyTypeId} required />

      <Pressable
        onPress={handleUseMyLocation}
        disabled={locating}
        className="items-center rounded-lg border border-blue-700 bg-blue-50 py-2 disabled:opacity-50"
      >
        <Text className="text-xs font-semibold text-blue-700">
          {locating ? 'Locating…' : coords ? '📍 Location captured' : '📍 Attach current location (optional)'}
        </Text>
      </Pressable>

      <Text className="text-[11px] text-gray-400">* Required</Text>

      <FormActions onCancel={onDone} onSave={handleSave} saving={saving} />
    </PopupCard>
  );
}

/** One party as the Ledger list works with it: the row itself plus its figures
 * for the period on screen. */
interface PartyRowData {
  row: MergedRow;
  totals: PartyTotals;
  /** What was billed to them (the customer ledger's sales and "customer owes" entries). */
  sales: number;
  /** What was bought from them on credit (the vendor ledger). */
  purchases: number;
  /** Money that actually moved: received from them plus paid out to them. */
  payments: number;
  /** Where the account stands at the end of the period; positive = they owe you. */
  balance: number;
  status: PartyStatus;
  /** The part of it that is overdue - 0 unless they owe you. */
  overdue: number;
  /** Their ledger type, when one is set. */
  typeName: string | undefined;
}

/** The balance as the shared balance cell draws it. */
function positionOf(data: PartyRowData): PartyPosition {
  const base = partyPosition({ receivable: data.balance, payable: 0 });
  // Both of their ledgers are in this one figure - say so, as the list always has.
  return { ...base, bothLedgers: data.totals.hasCustomer && data.totals.hasVendor };
}

const dash = (n: number) => (Math.round(n) === 0 ? '—' : bookMoney(n));

/** A party on a phone: who, how to reach them, when they last traded, Sales /
 * Purchases / Payments / Balance, and where they stand. */
function PartyCard({
  data,
  basePath,
  today,
  selecting,
  selected,
  onToggle,
}: {
  data: PartyRowData;
  basePath: string;
  today: string;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  if (data.row.kind !== 'customer') return <AppCustomerRow entry={data.row.entry} />;
  const { customer, isApp } = data.row;
  const { totals } = data;
  // The ledger type and how to reach them, side by side on one line.
  const typeAndContact = [data.typeName, customer.phone, customer.address].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => (selecting ? onToggle() : router.push(`${basePath}/customer/${customer.id}` as any))}
      className="mb-2.5 rounded-2xl border bg-white p-3.5"
      style={{ borderColor: selected ? '#2563EB' : '#E5E7EB' }}
    >
      <View className="flex-row items-start" style={{ gap: 10 }}>
        {selecting && <Checkbox checked={selected} onPress={onToggle} label={`Select ${customer.name}`} />}
        <View className="flex-1" style={{ minWidth: 0 }}>
          {/* Wraps, so on a narrow phone the APP badge drops below the name instead of cutting it short. */}
          <View className="flex-row flex-wrap items-center" style={{ columnGap: 8, rowGap: 4 }}>
            <Text className="font-semibold text-gray-900" style={{ flexShrink: 1 }} numberOfLines={1}>
              {nameCaps(customer.name)}
            </Text>
            {isApp && (
              <View className="flex-row items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5">
                <Ionicons name="phone-portrait-outline" size={11} color="#2563eb" />
                <Text className="text-[10px] font-bold text-blue-700">APP</Text>
              </View>
            )}
          </View>
          {!!typeAndContact && (
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
              {typeAndContact}
            </Text>
          )}
          {totals.lastDay && (
            <Text className="mt-0.5 text-[11px] text-gray-400" numberOfLines={1}>
              Last transaction {toBsHistoryLabel(totals.lastDay)} · {relativeDay(totals.lastDay, today)}
            </Text>
          )}
        </View>
        <View className="items-end" style={{ gap: 4 }}>
          <PartyBalance position={positionOf(data)} compact />
          <StatusBadges status={data.status} overdue={data.overdue > 0} />
        </View>
      </View>
      <View className="mt-2.5 flex-row border-t border-gray-100 pt-2" style={{ gap: 16 }}>
        <Text className="text-[12px] text-gray-500">
          Sales <Text className="font-semibold text-gray-800">{dash(data.sales)}</Text>
        </Text>
        <Text className="text-[12px] text-gray-500">
          Purchases <Text className="font-semibold text-gray-800">{dash(data.purchases)}</Text>
        </Text>
        <Text className="text-[12px] text-gray-500">
          Payments <Text className="font-semibold text-gray-800">{dash(data.payments)}</Text>
        </Text>
        {data.overdue > 0 && (
          <Text className="text-[12px] text-gray-500">
            Overdue <Text className="font-semibold" style={{ color: LEDGER_TONE.overdue.text }}>{bookMoney(data.overdue)}</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
}

interface AppCustomer {
  profile: Profile;
  requestCount: number;
  lastRequestAt: string;
}

// Real registered app users who have booked a service request with this
// reseller - distinct from the reseller's own hand-typed customer directory
// below. service_requests already scopes to this reseller via reseller_id,
// so this is every client they've actually served through the app.
function useAppCustomers(userId: string | undefined) {
  const { data: requests } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    enabled: !!userId,
  });

  const statsByClient = useMemo(() => {
    const map = new Map<string, { requestCount: number; lastRequestAt: string }>();
    for (const r of requests ?? []) {
      const cur = map.get(r.client_id);
      if (cur) {
        cur.requestCount += 1;
        if (r.created_at > cur.lastRequestAt) cur.lastRequestAt = r.created_at;
      } else {
        map.set(r.client_id, { requestCount: 1, lastRequestAt: r.created_at });
      }
    }
    return map;
  }, [requests]);

  const clientIds = useMemo(() => Array.from(statsByClient.keys()).sort(), [statsByClient]);

  const { data: profiles } = useQuery({
    queryKey: ['app-customer-profiles', clientIds],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').in('id', clientIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: clientIds.length > 0,
  });

  return useMemo((): AppCustomer[] => {
    return (profiles ?? [])
      .map((profile) => ({ profile, ...statsByClient.get(profile.id)! }))
      .sort((a, b) => (a.lastRequestAt < b.lastRequestAt ? 1 : -1));
  }, [profiles, statsByClient]);
}

function AppCustomerRow({ entry }: { entry: AppCustomer }) {
  const { profile, requestCount, lastRequestAt } = entry;
  return (
    <View className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="flex-1 font-semibold text-gray-900" numberOfLines={1}>
          {profile.full_name ?? 'Unnamed'}
        </Text>
        <View className="flex-row items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5">
          <Ionicons name="phone-portrait-outline" size={11} color="#2563eb" />
          <Text className="text-[10px] font-bold text-blue-700">APP</Text>
        </View>
      </View>
      {!!profile.phone && (
        <Text className="mt-0.5 text-xs text-gray-500">
          <Ionicons name="call-outline" size={11} color="#9CA3AF" /> {profile.phone}
        </Text>
      )}
      {!!profile.city && (
        <Text className="mt-0.5 text-xs text-gray-500">
          <Ionicons name="location-outline" size={11} color="#9CA3AF" /> {profile.city}
        </Text>
      )}
      <Text className="mt-1.5 text-xs text-gray-400">
        {requestCount} request{requestCount === 1 ? '' : 's'} · last on {new Date(lastRequestAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
}

/** Button + status line for the "Your Customers" tab: first tap asks for
 * contacts permission and does an initial pull; after that, the app keeps
 * this list in sync with the phone's contacts automatically in the
 * background (useContactsSyncBootstrap), and this button just lets the
 * user force an immediate re-sync. */
function PhoneContactsSyncButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    isContactsSyncEnabled(userId).then(setEnabled);
    getLastSyncedAt(userId).then(setLastSynced);
  }, [userId]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { granted, synced } = await requestAndSyncPhoneContacts(userId);
      if (!granted) {
        showAlert('Contacts access needed', 'Allow contacts access to sync your phone contacts here.');
        return;
      }
      setEnabled(true);
      setLastSynced(new Date());
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showAlert('Synced', `${synced} phone contact${synced === 1 ? '' : 's'} synced to your customers.`);
    } catch (err) {
      showAlert('Could not sync contacts', getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View className="mb-3">
      <Pressable
        onPress={handleSync}
        disabled={syncing}
        className="flex-row items-center justify-center gap-2 rounded-2xl border border-blue-700 bg-blue-50 py-2.5 disabled:opacity-50"
      >
        <Ionicons name="sync-outline" size={16} color="#1d4ed8" />
        <Text className="text-xs font-semibold text-blue-700">
          {syncing ? 'Syncing…' : enabled ? 'Sync phone contacts now' : 'Sync from phone contacts'}
        </Text>
      </Pressable>
      {enabled && (
        <Text className="mt-1 text-center text-[10px] text-gray-400">
          {lastSynced ? `Auto-synced with your phone · last synced ${timeAgo(lastSynced)}` : 'Auto-synced with your phone'}
        </Text>
      )}
    </View>
  );
}

// One combined row: either a saved customer (tappable into the ledger) or,
// for a registered app user who's booked a request but was never saved to
// the customers directory, an app-only row (informational, same as the old
// "App Customers" tab - there's no customer_id to open a ledger for).
type MergedRow =
  | { kind: 'customer'; id: string; name: string; phone: string | null; customer: Customer; isApp: boolean }
  | { kind: 'app'; id: string; name: string; phone: string | null; entry: AppCustomer };

/** What the summary cards narrow the list to: 'open' is everyone with a balance either way (the Net balance card). */
type StatusFilter = 'all' | 'receivable' | 'payable' | 'open';

/** "No ledger type" in the bulk menu - the key can't clash with a real type's id. */
const NO_TYPE = '__none__';

/** Exports the list on screen to Excel. */
function ExportButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityLabel="Export the list to Excel"
      className="h-9 flex-row items-center rounded-lg border border-gray-300 bg-white px-3"
      style={{ gap: 6, opacity: busy ? 0.5 : 1 }}
    >
      <Ionicons name="download-outline" size={14} color="#4B5563" />
      <Text className="text-[13px] font-semibold text-gray-700">{busy ? 'Exporting…' : 'Export'}</Text>
    </Pressable>
  );
}

/** The strip that appears once something is ticked: what to do with those parties. */
function BulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  onSetType,
  onExport,
}: {
  count: number;
  /** How many parties the current filters match - "select all N". */
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onSetType: () => void;
  onExport: () => void;
}) {
  const action = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      className="h-8 flex-row items-center rounded-lg border border-blue-200 bg-white px-2.5"
      style={{ gap: 5 }}
    >
      <Ionicons name={icon} size={14} color="#1D4ED8" />
      <Text className="text-[12.5px] font-semibold text-blue-800">{label}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row flex-wrap items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2" style={{ gap: 8 }}>
      <Text className="text-[13px] font-bold text-blue-900">{count} selected</Text>
      {count < total && (
        <Pressable onPress={onSelectAll} hitSlop={6}>
          <Text className="text-[12.5px] font-semibold text-blue-700">Select all {total}</Text>
        </Pressable>
      )}
      <View className="flex-1" />
      {action('pricetag-outline', 'Set ledger type', onSetType)}
      {action('download-outline', 'Export selected', onExport)}
      <Pressable onPress={onClear} hitSlop={6}>
        <Text className="text-[12.5px] font-semibold text-gray-500">Clear</Text>
      </Pressable>
    </View>
  );
}

export function CustomersListScreen({ basePath }: { basePath: string }) {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  // The search is a popup (see ContactPickerModal): tap the search box, pick a party, and their ledger opens.
  const [pickerOpen, setPickerOpen] = useState(false);
  // A name typed in that popup that is not saved yet starts the New party form with it filled in.
  const [newPartyName, setNewPartyName] = useState('');
  const [showAddForm, setShowAddForm] = useState(add === '1');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // A phone shows tick boxes only while selecting; the wide table always has them.
  const [selecting, setSelecting] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const appCustomers = useAppCustomers(userId);
  const itemsByParty = useLedgerItems(userId);
  const { types: partyTypes, nameById: partyTypeName } = usePartyTypes(userId);

  const layout = useBookLayout();
  // The table has seven columns and needs the room (the sidebar takes 240px): below
  // 1200px a phone-style card list reads better.
  const { width: windowWidth } = useWindowDimensions();
  const tableMode = layout.wide && windowWidth >= 1200;
  const today = localTodayIso();

  // A saved customer whose phone matches a registered app user is marked
  // "APP" on their existing row instead of being listed twice; an app user
  // with no matching saved customer still shows up, just without a ledger
  // to open.
  const merged = useMemo((): MergedRow[] => {
    const customerPhones = new Set((customers ?? []).map((c) => c.phone).filter((p): p is string => !!p));
    const appPhones = new Set(appCustomers.map((a) => a.profile.phone).filter((p): p is string => !!p));

    const customerRows: MergedRow[] = (customers ?? []).map((c) => ({
      kind: 'customer',
      id: c.id,
      name: c.name,
      phone: c.phone,
      customer: c,
      isApp: !!c.phone && appPhones.has(c.phone),
    }));
    const appOnlyRows: MergedRow[] = appCustomers
      .filter((a) => !a.profile.phone || !customerPhones.has(a.profile.phone))
      .map((a) => ({
        kind: 'app',
        id: a.profile.id,
        name: a.profile.full_name ?? 'Unnamed',
        phone: a.profile.phone,
        entry: a,
      }));

    return [...customerRows, ...appOnlyRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, appCustomers]);

  // Every party's figures: all they have ever traded, as of today.
  const analysed = useMemo(
    (): PartyRowData[] =>
      merged.map((row) => {
        const all = row.kind === 'customer' ? itemsByParty.get(row.id) ?? [] : [];
        const totals = summarize(all);
        const sides = sideTotals(all);
        const balance = totals.closing;
        return {
          row,
          totals,
          sales: sides.billed,
          purchases: sides.purchased,
          payments: sides.received + sides.paid,
          balance,
          status: statusOf(balance),
          overdue: overdueAmount(balance, receivableAging(all, today)),
          typeName: row.kind === 'customer' && row.customer.party_type_id ? partyTypeName.get(row.customer.party_type_id) : undefined,
        };
      }),
    [merged, itemsByParty, today, partyTypeName]
  );

  // The headline cards count the way the Finance dashboard does, so the two always
  // agree: each ledger on its own - a customer who owes you counts as receivable, a
  // vendor you owe counts as payable - and one running the other way (a customer who
  // paid ahead, a vendor you overpaid) is left out rather than netted against the
  // other ledger. The rows below net a person's two ledgers into one figure, so their
  // total can differ. All parties, whatever the search and status filter say.
  const cards = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    for (const items of itemsByParty.values()) {
      let customerBalance = 0;
      let vendorBalance = 0;
      for (const item of items) {
        const signed = item.entryType === 'debit' ? item.amount : -item.amount;
        if (item.side === 'customer') customerBalance += signed;
        else vendorBalance += signed;
      }
      if (customerBalance > 0) receivable += customerBalance;
      if (vendorBalance > 0) payable += vendorBalance;
    }
    return { receivable, payable, net: receivable - payable };
  }, [itemsByParty]);

  // In name order (A-Z): `merged` is already sorted that way and filtering keeps the order.
  const filtered = useMemo(
    () =>
      filter === 'all'
        ? analysed
        : filter === 'open'
          ? analysed.filter((d) => d.status !== 'settled')
          : analysed.filter((d) => d.status === filter),
    [analysed, filter]
  );

  // --- selection (phone: the Select button): only saved parties - an app-only row has no ledger to act on ---
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllFiltered = () => setSelected(new Set(filtered.filter((d) => d.row.kind === 'customer').map((d) => d.row.id)));
  const clearSelection = () => {
    setSelected(new Set());
    setSelecting(false);
  };
  const selectedCount = selected.size;

  // --- bulk actions ---
  async function exportRows(onlySelected: boolean) {
    const source = onlySelected ? filtered.filter((d) => selected.has(d.row.id)) : filtered;
    if (source.length === 0) {
      showAlert('Nothing to export', 'No parties match what is on screen.');
      return;
    }
    setExporting(true);
    try {
      const rows: PartyListRow[] = source.map((d) => ({
        Party: nameCaps(d.row.name),
        'Ledger type': d.typeName ?? '',
        Phone: d.row.phone ?? '',
        Address: d.row.kind === 'customer' ? d.row.customer.address ?? '' : '',
        'Last transaction': d.totals.lastDay ? toBsHistoryLabel(d.totals.lastDay) : '',
        Sales: Math.round(d.sales),
        Purchases: Math.round(d.purchases),
        Payments: Math.round(d.payments),
        Balance: Math.abs(Math.round(d.balance)),
        'Dr / Cr': d.status === 'receivable' ? 'Dr' : d.status === 'payable' ? 'Cr' : '',
        Status: d.status === 'receivable' ? 'Receivable' : d.status === 'payable' ? 'Payable' : 'Settled',
        Overdue: Math.round(d.overdue),
      }));
      await exportPartiesXlsx(rows);
    } catch (err) {
      showAlert('Could not export', getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  async function applyLedgerType(key: string) {
    setTypeMenuOpen(false);
    const ids = [...selected];
    if (ids.length === 0) return;
    const { error } = await (supabase.from('customers') as any)
      .update({ party_type_id: key === NO_TYPE ? null : key })
      .in('id', ids);
    if (error) {
      showAlert('Could not set the ledger type', getErrorMessage(error));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    showAlert('Ledger type updated', `${ids.length} ${ids.length === 1 ? 'party' : 'parties'} updated.`);
    clearSelection();
  }
  const typeMenuOptions: MenuOption<string>[] = [
    ...partyTypes.map((t) => ({ key: t.id, label: t.name })),
    { key: NO_TYPE, label: 'No ledger type' },
  ];

  // Search, Export and New party live in the top bar on a wide screen (a plain row
  // above the tiles on a narrow one) - web only; the phone app keeps its own list
  // below. The bar keeps the callbacks it was last given, so Export reaches the
  // list as it is now through a ref.
  const exportNow = useRef(exportRows);
  exportNow.current = exportRows;
  const openNewParty = () => {
    setNewPartyName('');
    setShowAddForm(true);
  };
  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      right: (inBar) => (
        <>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Search the ledger"
            className="h-9 flex-row items-center rounded-lg border border-gray-200 bg-white px-3"
            style={inBar ? { width: 250 } : { flexGrow: 1, minWidth: 180 }}
          >
            <Ionicons name="search" size={15} color="#9CA3AF" />
            <Text className="ml-2 text-sm text-gray-400">Search by name or phone</Text>
          </Pressable>
          <ExportButton onPress={() => exportNow.current(false)} busy={exporting} />
          <ToolbarButton icon="add" label="New party" onPress={openNewParty} />
        </>
      ),
    },
    [exporting]
  );

  // --- pieces both layouts share ---
  const summaryCards = (
    <BookStats>
      <SummaryCard
        label="Net balance"
        value={`${cards.net < 0 ? '−' : ''}NPR ${bookMoney(Math.abs(cards.net))}`}
        color={cards.net > 0 ? LEDGER_TONE.receivable.text : cards.net < 0 ? LEDGER_TONE.payable.text : LEDGER_TONE.settled.text}
        accent={cards.net > 0 ? LEDGER_TONE.receivable.base : cards.net < 0 ? LEDGER_TONE.payable.base : LEDGER_TONE.settled.base}
        active={filter === 'open'}
        onPress={() => setFilter(filter === 'open' ? 'all' : 'open')}
      />
      <SummaryCard
        label="Total receivable"
        value={`NPR ${bookMoney(cards.receivable)}`}
        color={LEDGER_TONE.receivable.text}
        accent={LEDGER_TONE.receivable.base}
        active={filter === 'receivable'}
        onPress={() => setFilter(filter === 'receivable' ? 'all' : 'receivable')}
      />
      <SummaryCard
        label="Total payable"
        value={`NPR ${bookMoney(cards.payable)}`}
        color={LEDGER_TONE.payable.text}
        accent={LEDGER_TONE.payable.base}
        active={filter === 'payable'}
        onPress={() => setFilter(filter === 'payable' ? 'all' : 'payable')}
      />
      <SummaryCard
        label="Parties"
        value={String(merged.length)}
        color={LEDGER_TONE.settled.text}
        accent={LEDGER_TONE.settled.base}
        active={filter === 'all'}
        onPress={() => setFilter('all')}
      />
    </BookStats>
  );

  const addForm = (
    <>
      {showAddForm && userId ? (
        <AddCustomerForm userId={userId} basePath={basePath} initialName={newPartyName} onDone={() => setShowAddForm(false)} />
      ) : null}
      <ContactPickerModal
        visible={pickerOpen}
        initialQuery=""
        customers={customers ?? []}
        phoneContacts={[]}
        placeholder="Search by name or phone"
        matchPhone
        onSelectCustomer={(c) => {
          setPickerOpen(false);
          router.push(`${basePath}/customer/${c.id}` as any);
        }}
        onAddNewTyped={(name) => {
          setPickerOpen(false);
          setNewPartyName(name);
          setShowAddForm(true);
        }}
        onSelectNew={() => {}}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );

  const bulkBar =
    selectedCount > 0 ? (
      <BulkBar
        count={selectedCount}
        total={filtered.filter((d) => d.row.kind === 'customer').length}
        onSelectAll={selectAllFiltered}
        onClear={clearSelection}
        onSetType={() => setTypeMenuOpen(true)}
        onExport={() => exportRows(true)}
      />
    ) : null;

  const typeMenu = (
    <OptionMenuModal
      visible={typeMenuOpen}
      title={`Set ledger type · ${selectedCount} selected`}
      options={typeMenuOptions}
      onPick={applyLedgerType}
      onClose={() => setTypeMenuOpen(false)}
    />
  );

  const emptyState = (
    <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white py-10">
      <Ionicons name="people-outline" size={28} color="#D1D5DB" />
      <Text className="mt-2 text-gray-500">{merged.length > 0 ? 'No matches.' : 'No customers yet.'}</Text>
      <Text className="text-xs text-gray-400">
        {merged.length > 0 ? 'Try another filter.' : "Add one with New party, or they'll be saved when you record a bill for them."}
      </Text>
    </View>
  );

  // ---------------- wide screen: the ledger table ----------------
  if (tableMode) {
    // Under the name: the ledger type, the phone number and the address, on one line.
    const partyCell = (d: PartyRowData) => {
      const typeAndContact = [d.typeName, d.row.phone, d.row.kind === 'customer' ? d.row.customer.address : null].filter(Boolean).join(' · ');
      return (
        <View style={{ minWidth: 0 }}>
          {/* Wraps, so on a narrow screen the APP badge drops below the name instead of cutting it short. */}
          <View className="flex-row flex-wrap items-center" style={{ columnGap: 6, rowGap: 2 }}>
            <Text className="text-[13px] font-semibold text-gray-900">{nameCaps(d.row.name)}</Text>
            {(d.row.kind === 'app' || (d.row.kind === 'customer' && d.row.isApp)) && <Pill text="APP" color="#1D4ED8" bg="#EFF6FF" />}
          </View>
          {!!typeAndContact && (
            <Text className="text-[11px] text-gray-400" numberOfLines={1}>
              {typeAndContact}
            </Text>
          )}
        </View>
      );
    };

    const lastCell = (d: PartyRowData) =>
      d.totals.lastDay ? (
        <View>
          <Text className="text-[12.5px] text-gray-700">{toBsHistoryLabel(d.totals.lastDay)}</Text>
          <Text className="text-[11px] text-gray-400">{relativeDay(d.totals.lastDay, today)}</Text>
        </View>
      ) : (
        <Text className="text-[12.5px] text-gray-300">—</Text>
      );

    const figure = (n: number) => <Text className="text-[12.5px] text-gray-700">{dash(n)}</Text>;
    const open = (d: PartyRowData) => {
      if (d.row.kind === 'customer') router.push(`${basePath}/customer/${d.row.id}` as any);
    };

    const moneyColumn = (key: 'sales' | 'purchases', label: string): BookColumn<PartyRowData> => ({
      key,
      label,
      width: 95,
      align: 'right',
      render: (d) => figure(d[key]),
    });
    const columns: BookColumn<PartyRowData>[] = [
      { key: 'party', label: 'Party', render: partyCell },
      { key: 'last', label: 'Last transaction', width: 125, render: lastCell },
      moneyColumn('sales', 'Sales'),
      moneyColumn('purchases', 'Purchases'),
      {
        // The part of the balance that is money coming in (green), blank when it runs the other way.
        key: 'receivable',
        label: 'Receivable',
        width: 105,
        align: 'right',
        render: (d) =>
          d.status === 'receivable' ? (
            <Text className="text-[12.5px] font-bold" style={{ color: LEDGER_TONE.receivable.text }}>
              {bookMoney(d.balance)}
            </Text>
          ) : (
            <Text className="text-[12.5px] text-gray-300">—</Text>
          ),
      },
      {
        // The part of the balance that is money going out (red), blank when it runs the other way.
        key: 'payable',
        label: 'Payable',
        width: 105,
        align: 'right',
        render: (d) =>
          d.status === 'payable' ? (
            <Text className="text-[12.5px] font-bold" style={{ color: LEDGER_TONE.payable.text }}>
              {bookMoney(-d.balance)}
            </Text>
          ) : (
            <Text className="text-[12.5px] text-gray-300">—</Text>
          ),
      },
      { key: 'balance', label: 'Balance', width: 120, align: 'right', render: (d) => <PartyBalance position={positionOf(d)} compact /> },
    ];

    // The listed rows' own figures added up (every page, not just this one), so
    // the footer always agrees with the list above it.
    const footerNet = filtered.reduce((sum, d) => sum + d.balance, 0);
    const footerPosition = partyPosition({ receivable: footerNet, payable: 0 });

    return (
      <BookPage wide={layout.wide}>
        {toolbar}
        {summaryCards}
        {addForm}
        {bulkBar}

        {filtered.length === 0 ? (
          emptyState
        ) : (
          <BookTable
            columns={columns}
            rows={filtered}
            rowKey={(d) => `${d.row.kind}-${d.row.id}`}
            onRowPress={open}
            footer={{
              label: `${filtered.length} ${filtered.length === 1 ? 'party' : 'parties'} · Total`,
              cells: {
                sales: <Text className="text-[12.5px] font-bold text-gray-800">{bookMoney(filtered.reduce((sum, d) => sum + d.sales, 0))}</Text>,
                purchases: <Text className="text-[12.5px] font-bold text-gray-800">{bookMoney(filtered.reduce((sum, d) => sum + d.purchases, 0))}</Text>,
                receivable: (
                  <Text className="text-[12.5px] font-bold" style={{ color: LEDGER_TONE.receivable.text }}>
                    {bookMoney(filtered.reduce((sum, d) => (d.status === 'receivable' ? sum + d.balance : sum), 0))}
                  </Text>
                ),
                payable: (
                  <Text className="text-[12.5px] font-bold" style={{ color: LEDGER_TONE.payable.text }}>
                    {bookMoney(filtered.reduce((sum, d) => (d.status === 'payable' ? sum - d.balance : sum), 0))}
                  </Text>
                ),
                balance: <PartyBalance position={footerPosition} compact />,
              },
            }}
          />
        )}

        {typeMenu}
      </BookPage>
    );
  }

  // ---------------- phone / narrow window: cards ----------------
  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Search the ledger"
            className="flex-1 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5"
          >
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text className="ml-2 text-sm text-gray-400">Search by name or phone</Text>
          </Pressable>
          <Pressable onPress={openNewParty} className="h-11 w-11 items-center justify-center rounded-2xl bg-orange-500">
            <Ionicons name="add" size={22} color="white" />
          </Pressable>
        </View>

        {summaryCards}

        {userId && <PhoneContactsSyncButton userId={userId} />}

        <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => (selecting ? clearSelection() : setSelecting(true))}
            className="h-9 flex-row items-center rounded-lg border px-3"
            style={{ gap: 6, borderColor: selecting ? '#2563EB' : '#D1D5DB', backgroundColor: selecting ? '#EFF6FF' : '#FFFFFF' }}
          >
            <Ionicons name="checkbox-outline" size={14} color={selecting ? '#1D4ED8' : '#4B5563'} />
            <Text className={`text-[13px] font-semibold ${selecting ? 'text-blue-700' : 'text-gray-700'}`}>{selecting ? 'Done' : 'Select'}</Text>
          </Pressable>
          <ExportButton onPress={() => exportRows(false)} busy={exporting} />
        </View>

        {addForm}
        {bulkBar}

        {filtered.length === 0 ? (
          emptyState
        ) : (
          <View>
            {filtered.map((d) => (
              <PartyCard
                key={`${d.row.kind}-${d.row.id}`}
                data={d}
                basePath={basePath}
                today={today}
                selecting={selecting}
                selected={selected.has(d.row.id)}
                onToggle={() => toggle(d.row.id)}
              />
            ))}
          </View>
        )}

        {typeMenu}
      </ScrollView>
    </View>
  );
}
