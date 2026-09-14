// lib/components/CategoryBadge.tsx
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryVisual } from '../constants/categoryIcons';
import { useSupabaseQuery } from '../hooks/useSupabase';

export function CategoryBadge({
  category,
  size = 44,
  emoji,
  categoryId,
  visualKey,
}: {
  category: string | null | undefined;
  size?: number;
  emoji?: string | null;
  categoryId?: string | null;
  visualKey?: string | null;
}) {
  // Job lists only have free text like "Computer Desktop - Repair", which is
  // matched against the built-in names. A category renamed in admin (e.g.
  // "Computer Repair" -> "Computer Desktop") stops matching and falls back to
  // a plain wrench, so look up the live category row and use its pinned
  // visual_key instead. Same query key as the service picker, so it is one
  // shared, cached request - and skipped when the caller already knows the row.
  const needsLookup = !visualKey && !categoryId && !!category;
  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
    enabled: needsLookup,
  });
  const matched = needsLookup
    ? (categories ?? [])
        .filter((c) => category!.startsWith(c.label))
        .sort((a, b) => b.label.length - a.label.length)[0]
    : undefined;

  const { bg, icon, image } = getCategoryVisual(
    category,
    categoryId ?? matched?.id,
    visualKey ?? matched?.visual_key
  );

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
      ) : emoji ?? matched?.icon ? (
        <Text style={{ fontSize: Math.round(size * 0.4) }}>{emoji ?? matched?.icon}</Text>
      ) : (
        <Ionicons name="construct" size={Math.round(size * 0.45)} color="white" />
      )}
    </View>
  );
}
