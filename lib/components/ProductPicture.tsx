// lib/components/ProductPicture.tsx
import { useEffect, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toSafeImageUri } from '../utils/image';

/** A product's picture in a box of the size given, cropped to fill it - or, when it has none (or it will
 * not load), a plain box with a parcel icon, so a list of items never has gaps in it. */
export function ProductPicture({
  uri,
  style,
  iconSize = 22,
}: {
  uri: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const safe = toSafeImageUri(uri);
  // A new picture gets a fresh try.
  useEffect(() => setFailed(false), [safe]);

  return (
    <View className="items-center justify-center overflow-hidden rounded-lg bg-gray-100" style={style}>
      {safe && !failed ? (
        <Image source={{ uri: safe }} className="h-full w-full" resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Ionicons name="cube-outline" size={iconSize} color="#9CA3AF" />
      )}
    </View>
  );
}
