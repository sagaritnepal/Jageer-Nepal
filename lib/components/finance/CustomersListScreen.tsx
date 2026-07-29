// lib/components/finance/CustomersListScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../hooks/useSupabase';
import { SearchBar } from '../SearchBar';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { Customer } from '../../../types/database.types';

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
    setSaving(true);
    try {
      await createCustomer.mutateAsync({
        owner_id: userId,
        name: name.trim(),
        phone: phone.trim() || null,
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
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
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

export function CustomersListScreen({ basePath }: { basePath: string }) {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(add === '1');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers ?? [];
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="flex-1">
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or phone" />
        </View>
        <Pressable
          onPress={() => setShowAddForm((v) => !v)}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-orange-500"
        >
          <Ionicons name={showAddForm ? 'close' : 'add'} size={22} color="white" />
        </Pressable>
      </View>

      {showAddForm && userId && <AddCustomerForm userId={userId} onDone={() => setShowAddForm(false)} />}

      <FlatList
        data={filtered}
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
    </View>
  );
}
