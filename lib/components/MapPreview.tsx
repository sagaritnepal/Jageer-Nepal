// lib/components/MapPreview.tsx
import { View, Text, Pressable, Linking } from 'react-native';
import WebView from 'react-native-webview';

// Roughly an 800m-wide box around the pin - close enough to confirm "is this
// the right spot" without the request needing a full pan/zoom map.
const DEGREE_SPAN = 0.008;

/** Renders an interactive OpenStreetMap preview (pan/zoom, marker at the
 * given point) via OSM's own free, keyless embed iframe - replaces an
 * earlier static-map image whose host (staticmap.openstreetmap.de) no
 * longer resolves, which made every location preview render blank. */
export function MapPreview({
  coords,
  height = 160,
}: {
  coords: { latitude: number; longitude: number };
  height?: number;
}) {
  const { latitude, longitude } = coords;
  const bbox = [
    longitude - DEGREE_SPAN,
    latitude - DEGREE_SPAN,
    longitude + DEGREE_SPAN,
    latitude + DEGREE_SPAN,
  ].join('%2C');
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <View className="overflow-hidden rounded-lg border border-gray-200">
      <WebView source={{ uri: embedUrl }} style={{ width: '100%', height }} scrollEnabled={false} />
      <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`)} className="px-2 py-1.5">
        <Text className="text-xs text-blue-600">Open in Google Maps →</Text>
      </Pressable>
    </View>
  );
}
