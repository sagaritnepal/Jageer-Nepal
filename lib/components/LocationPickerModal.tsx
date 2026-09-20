// lib/components/LocationPickerModal.tsx
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  Modal,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { showAlert, getErrorMessage } from '../utils/alert';

export type Coords = { latitude: number; longitude: number };

type SearchResult = { place_id: number; display_name: string; lat: string; lon: string };

// Nominatim (OpenStreetMap) is free and keyless, so this reuses it for both
// directions instead of adding a Google Places dependency - reverse lookup
// (coords -> address) already worked this way elsewhere; this adds forward
// search (typed place/landmark -> coords) the same way.
async function searchPlaces(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  return res.json();
}

async function reverseGeocode(coords: Coords): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
    { headers: { Accept: 'application/json' } }
  );
  const data = await res.json();
  return data?.display_name ?? null;
}

/** Lets the person confirm the device's current position or search for a
 * different place/landmark (e.g. to simulate an order coming from elsewhere)
 * before it's attached to the request. Opens defaulted to the device's GPS
 * position; search results move the preview pin instead. */
export function LocationPickerModal({
  visible,
  initialCoords,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initialCoords: Coords | null;
  onConfirm: (coords: Coords, address: string) => void;
  onClose: () => void;
}) {
  const [coords, setCoords] = useState<Coords | null>(initialCoords);
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    if (initialCoords) {
      setCoords(initialCoords);
    } else {
      locateDevice();
    }
    // Only re-run when the modal opens, not on every initialCoords change
    // from the parent (which would fight the search results below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(query.trim());
        if (searchSeq.current === seq) setResults(found);
      } catch {
        if (searchSeq.current === seq) setResults([]);
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  async function locateDevice() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Location permission needed', 'Allow location access to use your current position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCoords(next);
      const display = await reverseGeocode(next).catch(() => null);
      if (display) setAddress(display);
    } catch (err) {
      showAlert('Could not get location', getErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }

  function selectResult(result: SearchResult) {
    setCoords({ latitude: Number(result.lat), longitude: Number(result.lon) });
    setAddress(result.display_name);
    setQuery('');
    setResults([]);
  }

  function confirm() {
    if (!coords) return;
    onConfirm(coords, address);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
          <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-4" style={{ maxHeight: '85%' }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">Set location</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View className="mb-2.5 flex-row items-center rounded-lg border border-gray-300 bg-white px-3">
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search a place or landmark"
                className="flex-1 px-2 py-2.5 text-sm"
              />
              {searching && <ActivityIndicator size="small" color="#9CA3AF" />}
            </View>

            {results.length > 0 && (
              <View className="mb-2.5 overflow-hidden rounded-lg border border-gray-200" style={{ maxHeight: 180 }}>
                {results.map((r) => (
                  <Pressable
                    key={r.place_id}
                    onPress={() => selectResult(r)}
                    className="border-b border-gray-100 px-3 py-2.5"
                  >
                    <Text className="text-sm text-gray-800" numberOfLines={2}>
                      {r.display_name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              onPress={locateDevice}
              disabled={locating}
              className="mb-2.5 flex-row items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-50 py-2.5 disabled:opacity-50"
            >
              <Ionicons name="locate" size={16} color="#1D4ED8" />
              <Text className="text-sm font-semibold text-blue-700">
                {locating ? 'Locating…' : 'Use my current location'}
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

            {!!address && <Text className="mb-3 text-xs text-gray-500" numberOfLines={3}>{address}</Text>}

            <View className="flex-row gap-2">
              <Pressable onPress={onClose} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
                <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={!coords}
                className="flex-1 items-center rounded-lg bg-blue-600 py-2.5 disabled:opacity-40"
              >
                <Text className="text-sm font-semibold text-white">Use this location</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
