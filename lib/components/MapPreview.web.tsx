// lib/components/MapPreview.web.tsx
import { View, Text, Pressable, Linking } from 'react-native';
import { osmEmbedUrl } from '../utils/mapEmbedUrl';

/** Web counterpart of MapPreview - react-native-webview has no web
 * implementation, so this renders the same OSM embed URL in a plain
 * <iframe> instead. Metro resolves this file automatically for web
 * builds in place of MapPreview.tsx. */
export function MapPreview({
  coords,
  height = 160,
}: {
  coords: { latitude: number; longitude: number };
  height?: number;
}) {
  return (
    <View className="overflow-hidden rounded-lg border border-gray-200">
      <iframe src={osmEmbedUrl(coords)} title="Location preview" style={{ width: '100%', height, border: 0, display: 'block' }} />
      <Pressable
        onPress={() => Linking.openURL(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)}
        className="px-2 py-1.5"
      >
        <Text className="text-xs text-blue-600">Open in Google Maps →</Text>
      </Pressable>
    </View>
  );
}
