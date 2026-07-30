// app/(reseller)/request-details.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Linking, Platform, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from '../../lib/hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { DateField, TimeField } from '../../lib/components/DateTimeFields';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { resizeImageForUpload } from '../../lib/utils/resizeImage';
import type { Customer } from '../../types/database.types';

const PHOTO_SLOTS = 3;

export default function ResellerRequestDetails() {
  const { category, action } = useLocalSearchParams<{ category: string; action: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const createRequest = useSupabaseInsert('service_requests');
  const createCustomer = useSupabaseInsert('customers');
  const updateCustomer = useSupabaseUpdate('customers');
  const { data: myCustomers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustContactPerson, setNewCustContactPerson] = useState('');
  const [newCustContactSame, setNewCustContactSame] = useState(true);
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactSameAsCustomer, setContactSameAsCustomer] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>(Array(PHOTO_SLOTS).fill(null));
  const [notes, setNotes] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeringCustomer, setRegisteringCustomer] = useState(false);

  async function handleUseMyLocation() {
    setLocatingMe(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Location permission needed', 'Allow location access to attach your position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      setCoords({ latitude, longitude });

      try {
        // expo-location's reverseGeocodeAsync isn't supported on web, so we
        // use OpenStreetMap's free Nominatim API (no key needed) instead -
        // it works the same way on every platform since it's a plain fetch.
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        if (data?.display_name) setAddress(data.display_name);
      } catch {
        // The reseller can still type the address manually if this fails.
      }
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocatingMe(false);
    }
  }

  async function handlePickContact() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Contacts access needed', 'Allow contacts access to pick a customer from your phone.');
        return;
      }
      const contact = await Contacts.Contact.presentPicker();
      if (!contact) return;

      const [fullName, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
      setCustomerId(null);
      if (fullName) setCustomerName(fullName);
      const phone = phones[0]?.number;
      if (phone) setCustomerPhone(phone.replace(/[^\d+]/g, ''));
      if (!phone) {
        showAlert('No phone number', 'That contact has no phone number saved — add one manually.');
      }
    } catch (err) {
      showAlert('Could not read contact', getErrorMessage(err));
    }
  }

  function handleSelectCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone ?? '');
    if (customer.address) setAddress(customer.address);
    if (customer.latitude != null && customer.longitude != null) {
      setCoords({ latitude: customer.latitude, longitude: customer.longitude });
    }
    const savedContact = customer.contact_person_name?.trim();
    if (savedContact && savedContact !== customer.name.trim()) {
      setContactPerson(savedContact);
      setContactSameAsCustomer(false);
    } else {
      setContactPerson('');
      setContactSameAsCustomer(true);
    }
    setShowCustomerSuggestions(false);
  }

  async function handleRegisterNow() {
    if (!userId || !customerName.trim()) return;
    if (!address.trim() && !coords) {
      showAlert('Add a location first', "Add the customer's location before registering them.");
      return;
    }
    setRegisteringCustomer(true);
    try {
      const created = await createCustomer.mutateAsync({
        owner_id: userId,
        name: customerName.trim(),
        phone: customerPhone.trim() || null,
        address: address.trim() || null,
        contact_person_name: contactSameAsCustomer ? null : contactPerson.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      setCustomerId(created.id);
      showAlert('Customer added', `${customerName.trim()} has been saved to My Customers.`);
    } catch (err) {
      showAlert('Could not register customer', getErrorMessage(err));
    } finally {
      setRegisteringCustomer(false);
    }
  }

  const customerSuggestions = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = myCustomers ?? [];
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [myCustomers, customerSearch]);

  // Live matches shown right under the name field as the reseller types,
  // so picking a saved customer doesn't require opening the book-icon modal.
  const inlineSuggestions = useMemo(() => {
    if (customerId) return [];
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    return (myCustomers ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [myCustomers, customerName, customerId]);

  function openCustomerPicker() {
    setCustomerSearch('');
    setShowCustomerSuggestions(true);
  }

  function openNewCustomerModal() {
    setNewCustName(customerName.trim());
    setNewCustPhone(customerPhone.trim());
    setNewCustAddress(address.trim());
    setNewCustContactPerson(contactSameAsCustomer ? '' : contactPerson.trim());
    setNewCustContactSame(contactSameAsCustomer);
    setShowCustomerSuggestions(false);
    setShowNewCustomerModal(true);
  }

  function closeNewCustomerModal() {
    setShowNewCustomerModal(false);
  }

  async function handleSaveNewCustomer() {
    if (!userId || !newCustName.trim()) {
      showAlert('Add a name', "Enter the customer's name to save them.");
      return;
    }
    setSavingNewCustomer(true);
    try {
      const created = await createCustomer.mutateAsync({
        owner_id: userId,
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
        address: newCustAddress.trim() || null,
        contact_person_name: newCustContactSame ? null : newCustContactPerson.trim() || null,
        latitude: null,
        longitude: null,
      });
      handleSelectCustomer(created);
      setShowNewCustomerModal(false);
      showAlert('Customer added', `${newCustName.trim()} has been saved to My Customers.`);
    } catch (err) {
      showAlert('Could not add customer', getErrorMessage(err));
    } finally {
      setSavingNewCustomer(false);
    }
  }

  async function handlePickPhoto(index: number) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo library access to attach pictures.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const resizedUri = await resizeImageForUpload(asset.uri, asset.width, 1024);
      setPhotos((prev) => prev.map((p, i) => (i === index ? resizedUri : p)));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.map((p, i) => (i === index ? null : p)));
  }

  async function uploadPhoto(uri: string, index: number): Promise<string> {
    const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());
    const path = `${userId}/${Date.now()}-${index}.jpg`;
    const { error } = await supabase.storage
      .from('request-photos')
      .upload(path, arraybuffer, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  }

  async function handleSubmit() {
    if (!userId) {
      showAlert('Please sign in', 'Your session may have expired — sign in again and retry.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      showAlert('Add customer details', "Enter the customer's name and phone so the technician can reach them.");
      return;
    }
    if (!date.trim() || !time.trim()) {
      showAlert('Add date and time', 'Let us know when you need this service.');
      return;
    }
    if (!address.trim() && !coords) {
      showAlert('Add a location', 'Use your current location or type an address.');
      return;
    }
    const price = quotedPrice.trim() ? Number(quotedPrice) : null;
    if (price != null && (Number.isNaN(price) || price <= 0)) {
      showAlert('Invalid price', 'Enter a valid price in NPR, or leave it blank if you don\'t know it yet.');
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        if (uri) photoUrls.push(await uploadPhoto(uri, i));
      }

      // Keep the customer directory in sync: update the saved record if one
      // was picked (and possibly edited here), or save a brand new one so
      // it's ready to reuse next time. Never blocks the booking if it fails.
      const resolvedContactPerson = contactSameAsCustomer ? null : contactPerson.trim() || null;

      let linkedCustomerId: string | null = customerId;
      try {
        const customerValues = {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: address.trim() || null,
          contact_person_name: resolvedContactPerson,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        };
        if (linkedCustomerId) {
          await updateCustomer.mutateAsync({ id: linkedCustomerId, values: customerValues });
        } else {
          const created = await createCustomer.mutateAsync({ owner_id: userId, ...customerValues });
          linkedCustomerId = created.id;
        }
      } catch {
        linkedCustomerId = null;
      }

      await createRequest.mutateAsync({
        client_id: userId,
        reseller_id: userId,
        customer_id: linkedCustomerId,
        origin: 'reseller',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        contact_person_name: resolvedContactPerson ?? customerName.trim(),
        issue_type: `${category} - ${action}`,
        description: notes.trim() || null,
        status: 'pending',
        quoted_price: price,
        scheduled_date: date.trim(),
        scheduled_time: time.trim(),
        location_data: { ...coords, address: address.trim() },
        photo_urls: photoUrls,
      });

      showAlert('Request submitted', 'Assign a technician from the Requests tab whenever you’re ready.');
      router.replace('/(reseller)/requests');
    } catch (err) {
      showAlert('Something went wrong', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="mb-6 flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
        <Text className="text-sm font-semibold text-blue-700">
          {category} · {action}
        </Text>
      </View>

      {Platform.OS !== 'web' && (
        <Pressable
          onPress={handlePickContact}
          className="mb-4 flex-row items-center justify-center gap-1.5 rounded-lg border border-blue-700 bg-blue-50 py-2.5"
        >
          <Ionicons name="person-add-outline" size={16} color="#1d4ed8" />
          <Text className="text-sm font-semibold text-blue-700">Pick from phone contacts</Text>
        </Pressable>
      )}

      <Text className="mb-2 text-sm font-medium text-gray-700">Customer name</Text>
      <View className="mb-1 flex-row items-center rounded-lg border border-gray-300 bg-white">
        <TextInput
          value={customerName}
          onChangeText={(text) => {
            setCustomerName(text);
            setCustomerId(null);
          }}
          placeholder="Who is this request for?"
          className="flex-1 px-4 py-3 text-base"
        />
        <Pressable onPress={openCustomerPicker} hitSlop={8} className="px-3">
          <Ionicons name="book-outline" size={20} color="#1d4ed8" />
        </Pressable>
      </View>

      {inlineSuggestions.length > 0 && (
        <View className="mb-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {inlineSuggestions.map((c, idx) => (
            <Pressable
              key={c.id}
              onPress={() => handleSelectCustomer(c)}
              className={`px-4 py-2.5 ${idx !== inlineSuggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <Text className="text-sm font-semibold text-gray-900">{c.name}</Text>
              {!!c.phone && <Text className="text-xs text-gray-500">{c.phone}</Text>}
            </Pressable>
          ))}
        </View>
      )}
      <Text className="mb-4 text-xs text-gray-400">
        Matches from your saved customers appear as you type. Tap the book icon to browse all or add a new customer.
      </Text>

      <Modal
        visible={showCustomerSuggestions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomerSuggestions(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => setShowCustomerSuggestions(false)}
        >
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-3" style={{ maxHeight: '70%' }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">My Customers</Text>
              <Pressable onPress={() => setShowCustomerSuggestions(false)} className="px-2 py-1">
                <Text className="text-sm font-semibold text-blue-700">Close</Text>
              </Pressable>
            </View>
            <TextInput
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Search by name"
              autoFocus
              className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <Pressable
              onPress={openNewCustomerModal}
              className="mb-2 flex-row items-center justify-center gap-1.5 rounded-lg border border-orange-400 bg-orange-50 py-2"
            >
              <Ionicons name="person-add-outline" size={16} color="#c2410c" />
              <Text className="text-sm font-semibold text-orange-700">+ Add new customer</Text>
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              {customerSuggestions.length === 0 ? (
                <Text className="px-2 py-3 text-center text-sm text-gray-400">No saved customers match.</Text>
              ) : (
                customerSuggestions.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => handleSelectCustomer(c)}
                    className="border-b border-gray-100 px-2 py-2.5"
                  >
                    <Text className="text-sm font-semibold text-gray-900">{c.name}</Text>
                    {!!c.phone && <Text className="text-xs text-gray-500">{c.phone}</Text>}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showNewCustomerModal}
        transparent
        animationType="fade"
        onRequestClose={closeNewCustomerModal}
      >
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={closeNewCustomerModal}>
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-4">
            <Text className="mb-3 text-base font-semibold text-gray-900">New customer</Text>
            <Text className="mb-1 text-xs font-medium text-gray-600">Name</Text>
            <TextInput
              value={newCustName}
              onChangeText={setNewCustName}
              placeholder="Customer name"
              className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <Text className="mb-1 text-xs font-medium text-gray-600">Contact no.</Text>
            <TextInput
              value={newCustPhone}
              onChangeText={setNewCustPhone}
              placeholder="98XXXXXXXX"
              keyboardType="phone-pad"
              className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <Text className="mb-1 text-xs font-medium text-gray-600">Location</Text>
            <TextInput
              value={newCustAddress}
              onChangeText={setNewCustAddress}
              placeholder="House/street, city, area"
              multiline
              className="mb-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              style={{ minHeight: 50, textAlignVertical: 'top' }}
            />
            <Text className="mb-1 text-xs font-medium text-gray-600">Contact person</Text>
            <Pressable
              onPress={() => setNewCustContactSame((v) => !v)}
              className="mb-2 flex-row items-center gap-2"
              hitSlop={4}
            >
              <Ionicons name={newCustContactSame ? 'checkbox' : 'square-outline'} size={18} color="#1d4ed8" />
              <Text className="text-xs text-gray-600">Same as customer name</Text>
            </Pressable>
            {!newCustContactSame && (
              <TextInput
                value={newCustContactPerson}
                onChangeText={setNewCustContactPerson}
                placeholder="e.g. Office receptionist, site manager"
                className="mb-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            )}
            <View className="flex-row justify-end gap-3">
              <Pressable onPress={closeNewCustomerModal} className="px-3 py-2">
                <Text className="text-sm font-semibold text-gray-500">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveNewCustomer}
                disabled={savingNewCustomer}
                className="rounded-lg bg-orange-500 px-4 py-2 disabled:opacity-50"
              >
                <Text className="text-sm font-semibold text-white">{savingNewCustomer ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Text className="mb-2 text-sm font-medium text-gray-700">Customer phone</Text>
      <TextInput
        value={customerPhone}
        onChangeText={setCustomerPhone}
        placeholder="98XXXXXXXX"
        keyboardType="phone-pad"
        className="mb-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Location</Text>
      <Pressable
        onPress={handleUseMyLocation}
        disabled={locatingMe}
        className="mb-2 flex-row items-center justify-center rounded-lg border border-blue-700 bg-blue-50 py-2.5 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-blue-700">
          {locatingMe ? 'Locating…' : coords ? '📍 Location captured — tap to refresh' : '📍 Use my current location'}
        </Text>
      </Pressable>
      {coords && (
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)}
          className="mb-2 overflow-hidden rounded-lg border border-gray-200"
        >
          <Image
            source={{
              uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.latitude},${coords.longitude}&zoom=15&size=600x220&markers=${coords.latitude},${coords.longitude},red-pushpin`,
            }}
            style={{ width: '100%', height: 160 }}
            resizeMode="cover"
          />
          <Text className="px-2 py-1.5 text-xs text-blue-600">Open in Google Maps →</Text>
        </Pressable>
      )}
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="House/street, city, area"
        multiline
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        style={{ minHeight: 60, textAlignVertical: 'top' }}
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Contact person</Text>
      <Pressable
        onPress={() => setContactSameAsCustomer((v) => !v)}
        className="mb-2 flex-row items-center gap-2"
        hitSlop={4}
      >
        <Ionicons name={contactSameAsCustomer ? 'checkbox' : 'square-outline'} size={20} color="#1d4ed8" />
        <Text className="text-sm text-gray-600">Same as customer name</Text>
      </Pressable>
      {!contactSameAsCustomer && (
        <TextInput
          value={contactPerson}
          onChangeText={setContactPerson}
          placeholder="e.g. Office receptionist, site manager"
          className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        />
      )}

      {customerId ? (
        <View className="mb-4 flex-row items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-2">
          <Ionicons name="checkmark-circle" size={14} color="#0d9488" />
          <Text className="flex-1 text-xs font-medium text-teal-700">Using saved customer — edits here will update their record.</Text>
          <Pressable onPress={() => setCustomerId(null)}>
            <Text className="text-xs font-bold text-teal-700">Unlink</Text>
          </Pressable>
        </View>
      ) : (
        customerName.trim().length > 0 &&
        (address.trim().length > 0 || coords) && (
          <View className="mb-4 flex-row items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
            <Ionicons name="person-add-outline" size={14} color="#B45309" />
            <Text className="flex-1 text-xs font-medium text-amber-700">
              New customer — not in your saved list yet.
            </Text>
            <Pressable onPress={handleRegisterNow} disabled={registeringCustomer} hitSlop={8}>
              <Text className="text-xs font-bold text-amber-700">
                {registeringCustomer ? 'Adding…' : 'Register now'}
              </Text>
            </Pressable>
          </View>
        )
      )}

      <Text className="mb-2 text-sm font-medium text-gray-700">Date</Text>
      <View className="mb-4">
        <DateField value={date} onChange={setDate} />
      </View>

      <Text className="mb-2 text-sm font-medium text-gray-700">Time</Text>
      <View className="mb-4">
        <TimeField value={time} onChange={setTime} />
      </View>

      <Text className="mb-2 text-sm font-medium text-gray-700">Photos (optional, up to {PHOTO_SLOTS})</Text>
      <View className="mb-4 flex-row gap-2">
        {photos.map((uri, index) => (
          <Pressable
            key={index}
            onPress={() => (uri ? removePhoto(index) : handlePickPhoto(index))}
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white"
          >
            {uri ? (
              <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Text className="text-2xl text-gray-300">+</Text>
            )}
          </Pressable>
        ))}
      </View>
      {photos.some(Boolean) && <Text className="mb-4 text-xs text-gray-400">Tap a photo to remove it.</Text>}

      <Text className="mb-2 text-sm font-medium text-gray-700">Extra information (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else the technician should know?"
        multiline
        numberOfLines={4}
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Quoted price (NPR, optional)</Text>
      <Text className="mb-2 text-xs text-gray-400">
        If you already know what you'd charge, add it now so the technician knows what the job is worth — the
        customer still has to approve it before you can assign anyone. Leave it blank to price it later instead.
      </Text>
      <TextInput
        value={quotedPrice}
        onChangeText={setQuotedPrice}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className="items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">{submitting ? 'Submitting…' : 'Submit request'}</Text>
      </Pressable>
    </ScrollView>
  );
}
