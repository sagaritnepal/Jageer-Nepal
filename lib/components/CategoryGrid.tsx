// lib/components/CategoryGrid.tsx
import { Pressable, Text, View } from 'react-native';
import { CategoryBadge } from './CategoryBadge';
import type { ServiceCategory } from '../../types/database.types';

export function CategoryGrid({
  categories,
  onSelect,
  columns = 4,
}: {
  categories: ServiceCategory[];
  onSelect: (category: ServiceCategory) => void;
  /** Defaults to 4 (today's mobile layout) - the wider web sidebar shell
   * passes more so the grid actually uses laptop width instead of wrapping
   * into a tall, narrow column. */
  columns?: number;
}) {
  return (
    <View className="flex-row flex-wrap">
      {categories.map((c) => (
        <Pressable key={c.id} onPress={() => onSelect(c)} style={{ width: `${100 / columns}%` }} className="mb-5 items-center px-1">
          <CategoryBadge category={c.label} size={56} emoji={c.icon} categoryId={c.id} visualKey={c.visual_key} />
          <Text
            numberOfLines={2}
            className="mt-2 text-center text-[11.5px] font-semibold leading-[1.2] text-gray-800"
          >
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
