// lib/components/CategoryGrid.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CategoryBadge } from './CategoryBadge';
import type { ServiceCategory } from '../../types/database.types';

/** The service icon's size. A cell narrower than this (a small phone) shrinks the icon to fit instead of clipping it. */
const ICON_SIZE = 112;

/** How many service columns fit a wide page's main column: each needs about 130px for the icon and its name. */
export function categoryColumnsFor(width: number): number {
  return Math.min(10, Math.max(6, Math.floor(width / 130)));
}

export function CategoryGrid({
  categories,
  onSelect,
  columns = 3,
}: {
  categories: ServiceCategory[];
  onSelect: (category: ServiceCategory) => void;
  /** Defaults to 3 (the phone layout) - the wider web sidebar shell passes
   * more (see categoryColumnsFor) so the grid uses laptop width instead of
   * wrapping into a tall, narrow column. */
  columns?: number;
}) {
  const [width, setWidth] = useState(0);
  // Each cell has 4px of padding a side; the icon takes the rest of the cell, up to ICON_SIZE.
  const iconSize = width > 0 ? Math.min(ICON_SIZE, Math.floor(width / columns) - 8) : ICON_SIZE;
  return (
    <View className="flex-row flex-wrap" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {categories.map((c) => (
        <Pressable key={c.id} onPress={() => onSelect(c)} style={{ width: `${100 / columns}%` }} className="mb-5 items-center px-1">
          <CategoryBadge category={c.label} size={iconSize} emoji={c.icon} categoryId={c.id} visualKey={c.visual_key} />
          {/* Full name, never truncated: the cell grows, and a flex row stretches its siblings to match so labels stay top-aligned. */}
          <Text className="mt-1.5 text-center text-[13px] font-semibold leading-[17px] text-gray-900">
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
