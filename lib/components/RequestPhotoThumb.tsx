// lib/components/RequestPhotoThumb.tsx
import { useEffect, useState } from 'react';
import { View, Image, Text } from 'react-native';
import { supabase } from '../supabase';

// service_requests.photo_urls stores private storage paths, not usable URLs -
// this signs the first one so a small preview can show up wherever a request
// appears (list cards), not just the full detail page.
export function RequestPhotoThumb({ photoUrls, size = 44 }: { photoUrls: string[]; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (photoUrls.length === 0) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from('request-photos')
      .createSignedUrl(photoUrls[0], 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoUrls]);

  if (photoUrls.length === 0 || !url) return null;

  return (
    <View style={{ width: size, height: size }} className="overflow-hidden rounded-lg bg-gray-100">
      <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
      {photoUrls.length > 1 && (
        <View className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1">
          <Text className="text-[8px] font-bold text-white">+{photoUrls.length - 1}</Text>
        </View>
      )}
    </View>
  );
}
