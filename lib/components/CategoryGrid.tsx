// lib/components/CategoryGrid.tsx
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_BG_COLORS, CATEGORY_ICON_MAP } from '../constants/categoryIcons';
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
      {categories.map((c, i) => {
        const bg = CATEGORY_BG_COLORS[i % CATEGORY_BG_COLORS.length];
        const iconName = CATEGORY_ICON_MAP[c.label];
        return (
          <Pressable key={c.id} onPress={() => onSelect(c)} className="mb-5 w-1/4 items-center px-1">
            <View className={`h-14 w-14 items-center justify-center rounded-2xl ${bg}`}>
              {iconName ? (
                <Ionicons name={iconName} size={24} color="white" />
              ) : (
                <Text className="text-2xl">{c.icon}</Text>
              )}
            </View>
            <Text
              numberOfLines={2}
              className="mt-2 text-center text-[11.5px] font-semibold leading-[1.2] text-gray-800"
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
