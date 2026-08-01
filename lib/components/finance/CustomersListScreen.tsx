// lib/components/finance/CustomersListScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../hooks/useSupabase';
import { supabase } from '../../supabase';
import { SearchBar } from '../SearchBar';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { isValidPhone10 } from '../../utils/phone';
import type { Customer, Profile } from '../../../types/database.types';

type Tab = 'app' | 'yours';

/** Whether `phone` is already used by a different customer of this owner. */
async function phoneAlreadyUsed(ownerId: string, phone: string, excludeCustomerId?: string) {
  let query = supabase.from('customers').select('id').eq('owner_id', ownerId).eq('phone', phone);
  if (excludeCustomerId) query = query.neq('id', excludeCustomerId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

function AddCustomerForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const createCustomer = useSupabaseInsert('customers');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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
      if (trimmedPhone && (await phoneAlreadyUsed(userId, trimmedPhone))) {
        showAlert('Already saved', 'A customer with this phone number already exists.');
        return;
      }
      await createCustomer.mutateAsync({
        owner_id: userId,
        name: name.trim(),
        phone: trimmedPhone || null,
        address: address.trim() || null,
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
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">Add a customer</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <TextInput
        value={phone}
        onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
        placeholder="Phone (10 digits)"
        keyboardType="phone-pad"
        maxLength={10}
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="Address"
        className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
      />
      <Pressable
        onPress={handleUseMyLocation}
        disabled={locating}
        className="mb-3 items-center rounded-lg border border-blue-700 bg-blue-50 py-2 disabled:opacity-50"
      >
        <Text className="text-xs font-semibold text-blue-700">
          {locating ? 'Locating…' : coords ? '📍 Location captured' : '📍 Attach current location'}
        </Text>
      </Pressable>
      <View className="flex-row gap-2">
        <Pressable onPress={onDone} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-1 items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CustomerRow({ customer, basePath }: { customer: Customer; basePath: string }) {
  return (
    <Pressable
      onPress={() => router.push(`${basePath}/customer/${customer.id}` as any)}
      className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <Text className="font-semibold text-gray-900">{customer.name}</Text>
      {!!customer.phone && (
        <Text className="mt-0.5 text-xs text-gray-500">
          <Ionicons name="call-outline" size={11} color="#9CA3AF" /> {customer.phone}
        </Text>
      )}
      {!!customer.address && (
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
          <Ionicons name="location-outline" size={11} color="#9CA3AF" /> {customer.address}
        </Text>
      )}
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

export function CustomersListScreen({ basePath }: { basePath: string }) {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState<Tab>('app');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(add === '1');

  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const appCustomers = useAppCustomers(userId);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers ?? [];
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  const filteredAppCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appCustomers;
    return appCustomers.filter(
      (e) => (e.profile.full_name ?? '').toLowerCase().includes(q) || (e.profile.phone ?? '').includes(q)
    );
  }, [appCustomers, search]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => setTab('app')}
          className={`flex-1 items-center rounded-full py-2 ${tab === 'app' ? 'bg-orange-500' : 'border border-gray-200 bg-white'}`}
        >
          <Text className={`text-xs font-semibold ${tab === 'app' ? 'text-white' : 'text-gray-600'}`}>App Customers</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('yours')}
          className={`flex-1 items-center rounded-full py-2 ${tab === 'yours' ? 'bg-orange-500' : 'border border-gray-200 bg-white'}`}
        >
          <Text className={`text-xs font-semibold ${tab === 'yours' ? 'text-white' : 'text-gray-600'}`}>Your Customers</Text>
        </Pressable>
      </View>

      <View className="mb-3 flex-row items-center gap-2">
        <View className="flex-1">
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or phone" />
        </View>
        {tab === 'yours' && (
          <Pressable
            onPress={() => setShowAddForm((v) => !v)}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-orange-500"
          >
            <Ionicons name={showAddForm ? 'close' : 'add'} size={22} color="white" />
          </Pressable>
        )}
      </View>

      {tab === 'yours' && showAddForm && userId && (
        <AddCustomerForm userId={userId} onDone={() => setShowAddForm(false)} />
      )}

      {tab === 'app' ? (
        <FlatList
          data={filteredAppCustomers}
          keyExtractor={(item) => item.profile.id}
          renderItem={({ item }) => <AppCustomerRow entry={item} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
              <Ionicons name="phone-portrait-outline" size={28} color="#D1D5DB" />
              <Text className="mt-2 text-gray-500">
                {appCustomers.length > 0 ? 'No matches.' : 'No app customers yet.'}
              </Text>
              <Text className="text-xs text-gray-400">Shows up once someone books a request with you through the app.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CustomerRow customer={item} basePath={basePath} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
              <Ionicons name="people-outline" size={28} color="#D1D5DB" />
              <Text className="mt-2 text-gray-500">
                {customers && customers.length > 0 ? 'No matches.' : 'No customers saved yet.'}
              </Text>
              <Text className="text-xs text-gray-400">
                Add one above, or they'll be saved automatically when you book a job for them.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
