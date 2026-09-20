// lib/components/MapPreview.tsx
import { View, Text, Pressable, Linking } from 'react-native';
import WebView from 'react-native-webview';
import { osmEmbedUrl } from '../utils/mapEmbedUrl';

/** Renders an interactive OpenStreetMap preview (pan/zoom, marker at the
 * given point) via OSM's own free, keyless embed iframe - replaces an
 * earlier static-map image whose host (staticmap.openstreetmap.de) no
 * longer resolves, which made every location preview render blank.
 *
 * Native only - react-native-webview doesn't support the web target, so
 * MapPreview.web.tsx covers that platform with a plain <iframe> instead
 * and Metro picks whichever file matches the build target. */
export function MapPreview({
  coords,
  height = 160,
}: {
  coords: { latitude: number; longitude: number };
  height?: number;
}) {
  return (
    <View className="overflow-hidden rounded-lg border border-gray-200">
      <WebView source={{ uri: osmEmbedUrl(coords) }} style={{ width: '100%', height }} scrollEnabled={false} />
      <Pressable
        onPress={() => Linking.openURL(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`)}
        className="px-2 py-1.5"
      >
        <Text className="text-xs text-blue-600">Open in Google Maps →</Text>
      </Pressable>
    </View>
  );
}
