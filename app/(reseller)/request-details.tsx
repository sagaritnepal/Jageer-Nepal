// app/(reseller)/request-details.tsx
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Linking,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from '../../lib/hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { DateField, TimeField } from '../../lib/components/DateTimeFields';
import { ToggleSwitch } from '../../lib/components/ToggleSwitch';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { resizeImageForUpload } from '../../lib/utils/resizeImage';
import { pickPhoneContact } from '../../lib/utils/pickPhoneContact';
import { usePhoneContacts } from '../../lib/hooks/usePhoneContacts';
import { ContactPickerModal } from '../../lib/components/ContactPickerModal';
import type { Customer } from '../../types/database.types';

const PHOTO_SLOTS = 3;

export default function ResellerRequestDetails() {
  const { category, action } = useLocalSearchParams<{ category: string; action: string }>();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const userId = useAuthStore((state) => state.session?.user.id);
  const createRequest = useSupabaseInsert('service_requests');
  const createCustomer = useSupabaseInsert('customers');
  const updateCustomer = useSupabaseUpdate('customers');
  const { data: myCustomers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const phoneContacts = usePhoneContacts();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCoords, setNewCustCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingNewCust, setLocatingNewCust] = useState(false);
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companySameAsCustomer, setCompanySameAsCustomer] = useState(false);
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

  async function handleUseMyLocationForNewCust() {
    setLocatingNewCust(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Location permission needed', 'Allow location access to attach a position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      setNewCustCoords({ latitude, longitude });

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        if (data?.display_name) setNewCustAddress(data.display_name);
      } catch {
        // The reseller can still type the address manually if this fails.
      }
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocatingNewCust(false);
    }
  }

  async function handlePickNewCustFromContacts() {
    const picked = await pickPhoneContact();
    if (!picked) return;
    if (picked.name) setNewCustName(picked.name);
    if (picked.phone) setNewCustPhone(picked.phone);
  }

  function handleSelectCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone ?? '');
    if (customer.address) setAddress(customer.address);
    if (customer.latitude != null && customer.longitude != null) {
      setCoords({ latitude: customer.latitude, longitude: customer.longitude });
    }
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

  // A saved customer is selected directly; a phone contact not saved yet
  // just fills the fields (not created yet) - handleSubmit below already
  // saves a brand new customer from whatever's in these fields at booking
  // time, so there's no need to create one early here.
  function handleSelectNew(name: string, phone: string | null) {
    setShowNameSuggestions(false);
    setCustomerId(null);
    setCustomerName(name);
    if (phone) setCustomerPhone(phone);
  }

  function openNewCustomerModal() {
    setNewCustName(customerName.trim());
    setNewCustPhone(customerPhone.trim());
    setNewCustAddress(address.trim());
    setNewCustCoords(coords);
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
        latitude: newCustCoords?.latitude ?? null,
        longitude: newCustCoords?.longitude ?? null,
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

  // request-details is a hidden tab screen (see _layout.tsx), so React
  // Navigation keeps this component instance mounted across visits instead
  // of remounting it - without a reset, the previous request's customer,
  // date/time, address/photos/notes, and price would stay in state and
  // silently prefill the next request. Resetting on submit alone isn't
  // enough: cancelling out of a filled form leaves the same stale state
  // for the next visit, so this resets on every focus instead - screen
  // pickers/permission dialogs (photo, location, contacts) don't blur a
  // Tabs screen, so an in-progress fill is never wiped out from under it.
  useFocusEffect(
    useCallback(() => {
      setCustomerId(null);
      setCustomerName('');
      setCustomerPhone('');
      setCompanyName('');
      setCompanySameAsCustomer(false);
      setDate('');
      setTime('');
      setAddress('');
      setCoords(null);
      setPhotos(Array(PHOTO_SLOTS).fill(null));
      setNotes('');
      setQuotedPrice('');
    }, [])
  );

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
      let linkedCustomerId: string | null = customerId;
      try {
        const customerValues = {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: address.trim() || null,
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
        // Most likely a duplicate-phone conflict (customers_owner_phone_idx)
        // against a record that isn't in myCustomers' current cache yet -
        // link to it by phone instead of leaving the booking unlinked from
        // the contact book.
        const existing = customerPhone.trim()
          ? (myCustomers ?? []).find((c) => c.phone === customerPhone.trim())
          : undefined;
        linkedCustomerId = existing?.id ?? null;
      }

      await createRequest.mutateAsync({
        client_id: userId,
        reseller_id: userId,
        customer_id: linkedCustomerId,
        origin: 'reseller',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        contact_person_name: customerName.trim(),
        contact_person_phone: customerPhone.trim(),
        company_name: (companySameAsCustomer ? customerName : companyName).trim() || null,
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

  const missing: string[] = [];
  if (!customerName.trim()) missing.push('customer');
  if (!customerPhone.trim()) missing.push('phone');
  if (!address.trim() && !coords) missing.push('location');
  if (!date.trim() || !time.trim()) missing.push('date & time');
  const missingText = missing.join(', ').replace(/^./, (ch) => ch.toUpperCase());

  const cardWidth = isWideWeb ? ('calc((100% - 16px) / 2)' as unknown as number) : undefined;

  function changeService() {
    router.replace(`/(reseller)/new-request?category=${encodeURIComponent(category ?? '')}`);
  }

  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace('/(reseller)/requests');
  }

  const locationButton = (
    <Pressable
      onPress={handleUseMyLocation}
      disabled={locatingMe}
      className="flex-row items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-50 px-4 disabled:opacity-50"
      style={{ minHeight: 48 }}
    >
      <Ionicons name="locate" size={16} color="#1D4ED8" />
      <Text className="text-sm font-semibold text-blue-700">
        {locatingMe ? 'Locating…' : coords ? 'Location captured — tap to refresh' : 'Use my current location'}
      </Text>
    </Pressable>
  );

  const photoSlots = (
    <View className="flex-row gap-2.5">
      {photos.map((uri, index) => (
        <Pressable
          key={index}
          onPress={() => (uri ? removePhoto(index) : handlePickPhoto(index))}
          className="items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50"
          style={isWideWeb ? { width: 84, height: 84 } : { flex: 1, height: 88 }}
        >
          {uri ? (
            <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
              <Text className="mt-1 text-xs font-semibold text-gray-400">Add photo</Text>
            </>
          )}
        </Pressable>
      ))}
    </View>
  );

  const notesInput = (
    <TextInput
      value={notes}
      onChangeText={setNotes}
      placeholder="Anything else the technician should know?"
      multiline
      numberOfLines={3}
      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      style={[{ minHeight: 88, textAlignVertical: 'top' }, isWideWeb ? { flex: 1 } : null]}
    />
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: isWideWeb ? 32 : 16, paddingTop: isWideWeb ? 24 : 16, paddingBottom: 24 }}
      >
        <View className="mb-3 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
          <CategoryBadge category={category} size={40} />
          <View className="flex-1" style={{ gap: 3 }}>
            <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>
              {category}
            </Text>
            <View className="self-start rounded-full border border-orange-200 bg-orange-50 px-2 py-px">
              <Text className="text-[11px] font-semibold text-orange-700">{action}</Text>
            </View>
          </View>
          <Pressable
            onPress={changeService}
            hitSlop={8}
            className={isWideWeb ? 'rounded-lg border border-orange-200 px-3 py-2' : 'px-1 py-2.5'}
          >
            <Text className="text-sm font-semibold text-orange-600">{isWideWeb ? 'Change service' : 'Change'}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: isWideWeb ? 'row' : 'column', flexWrap: 'wrap', gap: isWideWeb ? 16 : 12 }}>
          <NumberedCard n={1} title="Who is it for?" subtitle="Saved customer or phone contact" wide={isWideWeb} width={cardWidth}>
            <Pressable
              onPress={() => {
                phoneContacts.request();
                setShowNameSuggestions(true);
              }}
              className="flex-row items-center gap-2.5 rounded-lg border border-gray-300 bg-white px-3"
              style={{ minHeight: 48 }}
            >
              {customerName ? (
                <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-orange-100">
                  <Text className="text-xs font-bold text-orange-700">{initialsOf(customerName)}</Text>
                </View>
              ) : null}
              <Text
                className={`flex-1 text-base ${customerName ? 'font-semibold text-gray-900' : 'text-gray-400'}`}
                numberOfLines={1}
              >
                {customerName || 'Who is this request for?'}
              </Text>
              {!!customerId && (
                <View className="rounded-full bg-emerald-50 px-2 py-0.5">
                  <Text className="text-[11px] font-semibold text-emerald-600">Saved customer</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable onPress={openNewCustomerModal} className="self-start py-2.5" hitSlop={4}>
              <Text className="text-[13px] font-semibold text-blue-600">+ Add a new customer manually</Text>
            </Pressable>

            {!customerId &&
              customerName.trim().length > 0 &&
              (address.trim().length > 0 || coords) && (
                <View className="mb-3 flex-row items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
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
              )}

            <Text className="mb-1.5 text-sm font-medium text-gray-700">Customer phone</Text>
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="98XXXXXXXX"
              keyboardType="phone-pad"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />

            <View className="mb-1.5 mt-3.5 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-gray-700">Company / office</Text>
              <Pressable
                onPress={() => setCompanySameAsCustomer((v) => !v)}
                className="flex-row items-center gap-2"
                hitSlop={8}
              >
                <Text className="text-[13px] text-gray-600">Same as customer</Text>
                <ToggleSwitch on={companySameAsCustomer} color="#2563EB" />
              </Pressable>
            </View>
            <TextInput
              value={companySameAsCustomer ? customerName : companyName}
              onChangeText={setCompanyName}
              editable={!companySameAsCustomer}
              placeholder="Company / office name"
              className={`rounded-lg border border-gray-300 px-4 py-3 text-base ${companySameAsCustomer ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
            />
          </NumberedCard>

          <NumberedCard n={2} title="Where and when?" subtitle="Seen by the technician before accepting" wide={isWideWeb} width={cardWidth}>
            {isWideWeb ? (
              <View className="flex-row gap-2.5">
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House/street, city, area"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                />
                {locationButton}
              </View>
            ) : (
              <>
                {locationButton}
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House/street, city, area"
                  multiline
                  className="mt-2.5 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  style={{ minHeight: 60, textAlignVertical: 'top' }}
                />
              </>
            )}
            {coords && (
              <Pressable
                onPress={() => Linking.openURL(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)}
                className="mt-2.5 overflow-hidden rounded-lg border border-gray-200"
              >
                <Image
                  source={{
                    uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.latitude},${coords.longitude}&zoom=15&size=600x220&markers=${coords.latitude},${coords.longitude},red-pushpin`,
                  }}
                  style={{ width: '100%', height: 140 }}
                  resizeMode="cover"
                />
                <Text className="px-2 py-1.5 text-xs text-blue-600">Open in Google Maps →</Text>
              </Pressable>
            )}

            <View className="mt-3.5 flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-gray-700">Date</Text>
                <DateField value={date} onChange={setDate} />
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-gray-700">Time</Text>
                <TimeField value={time} onChange={setTime} />
              </View>
            </View>
          </NumberedCard>

          <NumberedCard
            n={3}
            title="Show the problem"
            subtitle={`Optional — up to ${PHOTO_SLOTS} photos and notes help quoting`}
            wide={isWideWeb}
            width={cardWidth}
          >
            {isWideWeb ? (
              <View className="flex-row gap-4">
                {photoSlots}
                {notesInput}
              </View>
            ) : (
              <>
                {photoSlots}
                <View className="mt-3">{notesInput}</View>
              </>
            )}
            {photos.some(Boolean) && <Text className="mt-2 text-xs text-gray-400">Tap a photo to remove it.</Text>}
          </NumberedCard>

          <NumberedCard n={4} title="Price" subtitle="Optional — leave blank to price it later" wide={isWideWeb} width={cardWidth}>
            <View className="flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-4">
              <Text className="text-base font-semibold text-gray-500">NPR</Text>
              <TextInput
                value={quotedPrice}
                onChangeText={setQuotedPrice}
                placeholder="e.g. 2000"
                keyboardType="numeric"
                className="flex-1 py-3 text-base"
              />
            </View>
            <Text className="mt-2 text-xs leading-5 text-gray-400">
              The customer still approves the price before you can assign a technician.
            </Text>
          </NumberedCard>
        </View>
      </ScrollView>

      <View
        className="flex-row items-center gap-3 border-t border-gray-200 bg-white py-2.5"
        style={{
          paddingHorizontal: isWideWeb ? 32 : 16,
          shadowColor: '#111827',
          shadowOpacity: 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        }}
      >
        {isWideWeb && (
          <View className="flex-row items-center gap-3">
            <CategoryBadge category={category} size={36} />
            <View>
              <Text className="text-sm font-bold text-gray-900">
                {category} · {action}
              </Text>
              {!!customerName && <Text className="text-xs text-gray-500">{customerName}</Text>}
            </View>
          </View>
        )}
        <View className="flex-1" style={isWideWeb ? { alignItems: 'flex-end' } : undefined}>
          <Text className={`text-[13px] font-bold ${missing.length ? 'text-amber-700' : 'text-emerald-600'}`}>
            {missing.length ? `${missing.length} required left` : 'Ready to submit'}
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {missing.length
              ? missingText
              : quotedPrice.trim()
                ? 'Customer approves the price first'
                : 'You can add a price later'}
          </Text>
        </View>
        {isWideWeb && (
          <Pressable onPress={cancel} className="h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-5">
            <Text className="text-base font-semibold text-gray-600">Cancel</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="h-12 items-center justify-center rounded-lg bg-orange-500 px-6"
          style={{ opacity: submitting ? 0.5 : missing.length ? 0.6 : 1 }}
        >
          <Text className="text-base font-semibold text-white">{submitting ? 'Submitting…' : 'Submit request'}</Text>
        </Pressable>
      </View>

      <ContactPickerModal
        visible={showNameSuggestions}
        initialQuery=""
        customers={myCustomers ?? []}
        phoneContacts={phoneContacts.contacts}
        onSelectCustomer={(c) => {
          handleSelectCustomer(c);
          setShowNameSuggestions(false);
        }}
        onSelectNew={handleSelectNew}
        onClose={() => setShowNameSuggestions(false)}
      />

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
            <View className="mb-3 flex-row items-center rounded-lg border border-gray-300 bg-white">
              <TextInput
                value={newCustName}
                onChangeText={setNewCustName}
                placeholder="Customer name"
                className="flex-1 px-3 py-2 text-sm"
              />
              {Platform.OS !== 'web' && (
                <Pressable onPress={handlePickNewCustFromContacts} hitSlop={8} className="px-2.5">
                  <Ionicons name="person-add-outline" size={18} color="#1d4ed8" />
                </Pressable>
              )}
            </View>
            <Text className="mb-1 text-xs font-medium text-gray-600">Contact no.</Text>
            <TextInput
              value={newCustPhone}
              onChangeText={setNewCustPhone}
              placeholder="98XXXXXXXX"
              keyboardType="phone-pad"
              className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <Text className="mb-1 text-xs font-medium text-gray-600">Location</Text>
            <Pressable
              onPress={handleUseMyLocationForNewCust}
              disabled={locatingNewCust}
              className="mb-2 flex-row items-center justify-center gap-1.5 rounded-lg border border-blue-700 bg-blue-50 py-2 disabled:opacity-50"
            >
              <Ionicons name="locate" size={14} color="#1D4ED8" />
              <Text className="text-xs font-semibold text-blue-700">
                {locatingNewCust ? 'Locating…' : newCustCoords ? 'Location captured — tap to refresh' : 'Use my current location'}
              </Text>
            </Pressable>
            <TextInput
              value={newCustAddress}
              onChangeText={setNewCustAddress}
              placeholder="House/street, city, area"
              multiline
              className="mb-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              style={{ minHeight: 50, textAlignVertical: 'top' }}
            />
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
    </View>
  );
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function NumberedCard({
  n,
  title,
  subtitle,
  wide,
  width,
  children,
}: {
  n: number;
  title: string;
  subtitle: string;
  wide: boolean;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <View className={`rounded-2xl border border-gray-200 bg-white ${wide ? 'p-5' : 'p-4'}`} style={width ? { width } : undefined}>
      <View className="mb-3.5 flex-row items-center gap-2.5">
        <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-orange-50">
          <Text className="text-[13px] font-bold text-orange-700">{n}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900">{title}</Text>
          <Text className="text-xs text-gray-400">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}
