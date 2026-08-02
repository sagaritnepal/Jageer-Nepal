// lib/components/CategoryBadge.tsx
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryVisual } from '../constants/categoryIcons';

export function CategoryBadge({
  category,
  size = 44,
  emoji,
  categoryId,
}: {
  category: string | null | undefined;
  size?: number;
  emoji?: string | null;
  categoryId?: string | null;
}) {
  const { bg, icon, image } = getCategoryVisual(category, categoryId);

  if (image) {
    return (
      <Image
        source={image}
        style={{ width: size, height: size, borderRadius: 16 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className={`items-center justify-center rounded-2xl ${bg}`}
      style={{ width: size, height: size }}
    >
      {icon ? (
        <Ionicons name={icon} size={Math.round(size * 0.45)} color="white" />
      ) : emoji ? (
        <Text style={{ fontSize: Math.round(size * 0.4) }}>{emoji}</Text>
      ) : (
        <Ionicons name="construct" size={Math.round(size * 0.45)} color="white" />
      )}
    </View>
  );
}
