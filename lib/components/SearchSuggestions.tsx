// lib/components/SearchSuggestions.tsx
import { View, Text, Pressable, Image } from 'react-native';

interface SuggestionItem {
  id: string;
  name: string;
  category?: string | null;
  image_url?: string | null;
}

/** Autocomplete dropdown of matching products, positioned under a search bar (parent needs `relative`). */
export function SearchSuggestions<T extends SuggestionItem>({
  items,
  visible,
  onSelect,
}: {
  items: T[];
  visible: boolean;
  onSelect: (item: T) => void;
}) {
  if (!visible || items.length === 0) return null;

  return (
    <View className="absolute left-0 right-0 top-[54px] z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      {items.map((item, idx) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item)}
          className={`flex-row items-center gap-3 px-4 py-2.5 ${idx !== items.length - 1 ? 'border-b border-gray-100' : ''}`}
        >
          <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-gray-100">
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Text className="text-sm">📦</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-900" numberOfLines={1}>
              {item.name}
            </Text>
            {item.category && <Text className="text-[10px] text-gray-400">{item.category}</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
