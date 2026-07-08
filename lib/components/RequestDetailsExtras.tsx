// lib/components/RequestDetailsExtras.tsx
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking, ScrollView } from 'react-native';
import { supabase } from '../supabase';
import type { RequestLocation } from '../../types/database.types';

function RequestPhotos({ photoUrls }: { photoUrls: string[] }) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadSignedUrls() {
      const urls = await Promise.all(
        photoUrls.map(async (path) => {
          const { data } = await supabase.storage.from('request-photos').createSignedUrl(path, 3600);
          return data?.signedUrl ?? null;
        })
      );
      if (!cancelled) setSignedUrls(urls.filter((u): u is string => !!u));
    }
    if (photoUrls.length > 0) loadSignedUrls();
    return () => {
      cancelled = true;
    };
  }, [photoUrls]);

  if (photoUrls.length === 0) return null;

  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Photos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {signedUrls.map((url, i) => (
            <Image key={i} source={{ uri: url }} className="h-24 w-24 rounded-lg" resizeMode="cover" />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function RequestDetailsExtras({
  scheduledDate,
  scheduledTime,
  location,
  photoUrls,
}: {
  scheduledDate: string | null;
  scheduledTime: string | null;
  location: RequestLocation | null;
  photoUrls: string[];
}) {
  const hasSchedule = !!(scheduledDate || scheduledTime);
  const hasLocation = !!(location?.address || (location?.latitude != null && location?.longitude != null));

  if (!hasSchedule && !hasLocation && photoUrls.length === 0) return null;

  return (
    <View className="mt-4 rounded-xl bg-white p-5">
      <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Appointment</Text>

      {hasSchedule && (
        <Text className="text-sm text-gray-700">
          {scheduledDate ?? 'Date TBD'} · {scheduledTime ?? 'Time TBD'}
        </Text>
      )}

      {hasLocation && (
        <View className="mt-2">
          {location?.address ? <Text className="text-sm text-gray-700">{location.address}</Text> : null}
          {location?.latitude != null && location?.longitude != null && (
            <Pressable
              onPress={() => Linking.openURL(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`)}
            >
              <Text className="mt-1 text-xs text-blue-600">View on Google Maps →</Text>
            </Pressable>
          )}
        </View>
      )}

      <RequestPhotos photoUrls={photoUrls} />
    </View>
  );
}
