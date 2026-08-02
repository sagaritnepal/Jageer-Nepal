// lib/components/CategoryGrid.tsx
import { Pressable, Text, View } from 'react-native';
import { CategoryBadge } from './CategoryBadge';
import type { ServiceCategory } from '../../types/database.types';

export function CategoryGrid({
  categories,
  onSelect,
}: {
  categories: ServiceCategory[];
  onSelect: (category: ServiceCategory) => void;
}) {
  return (
    <View className="flex-row flex-wrap">
      {categories.map((c) => (
        <Pressable key={c.id} onPress={() => onSelect(c)} className="mb-5 w-1/4 items-center px-1">
          <CategoryBadge category={c.label} size={56} emoji={c.icon} categoryId={c.id} />
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
