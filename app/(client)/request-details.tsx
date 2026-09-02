// app/(client)/request-details.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert } from '../../lib/hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { DateField, TimeField } from '../../lib/components/DateTimeFields';
import { FormSection } from '../../lib/components/finance/FormSection';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { resizeImageForUpload } from '../../lib/utils/resizeImage';

const PHOTO_SLOTS = 3;

export default function RequestDetails() {
  // assistant* params arrive from the client-facing chat assistant (see
  // ClientAssistantChat) - applied once below, same "review before submit"
  // rule as everywhere else: this only fills fields, Submit is still a
  // manual, separate tap.
  const {
    category,
    action,
    assistantNotes,
    assistantDate,
    assistantTime,
    assistantAddress,
  } = useLocalSearchParams<{
    category: string;
    action: string;
    assistantNotes?: string;
    assistantDate?: string;
    assistantTime?: string;
    assistantAddress?: string;
  }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const createRequest = useSupabaseInsert('service_requests');

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>(Array(PHOTO_SLOTS).fill(null));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Depends on the actual param values (not just "on mount") since Expo
  // Router doesn't always have them hydrated on a freshly-pushed route's
  // very first render - a `[]` effect would fire once while they were
  // still undefined and never get a second chance (see the Finance voice
  // command's version of this same bug).
  useEffect(() => {
    if (assistantNotes) setNotes(assistantNotes);
    if (assistantDate) setDate(assistantDate);
    if (assistantTime) setTime(assistantTime);
    if (assistantAddress) setAddress(assistantAddress);
  }, [assistantNotes, assistantDate, assistantTime, assistantAddress]);

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
        // The client can still type the address manually if this fails.
      }
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocatingMe(false);
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
    if (!date.trim() || !time.trim()) {
      showAlert('Add date and time', 'Let us know when you need this service.');
      return;
    }
    if (!address.trim() && !coords) {
      showAlert('Add a location', 'Use your current location or type an address.');
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        if (uri) photoUrls.push(await uploadPhoto(uri, i));
      }

      await createRequest.mutateAsync({
        client_id: userId,
        issue_type: `${category} - ${action}`,
        description: notes.trim() || null,
        status: 'pending',
        scheduled_date: date.trim(),
        scheduled_time: time.trim(),
        location_data: { ...coords, address: address.trim() },
        photo_urls: photoUrls,
      });

      showAlert('Request submitted', 'A reseller will review it and assign a technician soon.');
      router.replace('/(client)/requests');
    } catch (err) {
      showAlert('Something went wrong', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="mb-5 flex-row items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3.5 py-3">
        <CategoryBadge category={category} size={34} />
        <Text className="flex-1 text-sm font-bold text-gray-900" numberOfLines={1}>
          {category} · {action}
        </Text>
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-4">
        <FormSection icon="calendar-outline" title="Schedule" first>
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Date</Text>
              <DateField value={date} onChange={setDate} />
            </View>
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Time</Text>
              <TimeField value={time} onChange={setTime} />
            </View>
          </View>
        </FormSection>

        <FormSection icon="location-outline" title="Location">
          <Pressable
            onPress={handleUseMyLocation}
            disabled={locatingMe}
            className="mb-2.5 flex-row items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-50 py-2.5 disabled:opacity-50"
          >
            <Ionicons name="locate" size={16} color="#1D4ED8" />
            <Text className="text-sm font-semibold text-blue-700">
              {locatingMe ? 'Locating…' : coords ? 'Location captured — tap to refresh' : 'Use my current location'}
            </Text>
          </Pressable>
          {coords && (
            <Pressable
              onPress={() => Linking.openURL(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)}
              className="mb-2.5 overflow-hidden rounded-lg border border-gray-200"
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
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </FormSection>

        <FormSection icon="camera-outline" title={`Photos (optional, up to ${PHOTO_SLOTS})`}>
          <View className="flex-row gap-2.5">
            {photos.map((uri, index) => (
              <Pressable
                key={index}
                onPress={() => (uri ? removePhoto(index) : handlePickPhoto(index))}
                className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50"
              >
                {uri ? (
                  <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                )}
              </Pressable>
            ))}
          </View>
          {photos.some(Boolean) && <Text className="mt-2 text-xs text-gray-400">Tap a photo to remove it.</Text>}
        </FormSection>

        <FormSection icon="document-text-outline" title="Extra information (optional)">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else the technician should know?"
            multiline
            numberOfLines={4}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
        </FormSection>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className="mt-5 items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">{submitting ? 'Submitting…' : 'Submit request'}</Text>
      </Pressable>
    </ScrollView>
  );
}
