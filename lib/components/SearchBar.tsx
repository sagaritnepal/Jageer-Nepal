// lib/components/SearchBar.tsx
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// A real, directly-typable search bar - filtering already reacts live to
// the `value` state in every screen that uses this, so there's nothing to
// "apply". The clear button only shows once there's text, faded so it
// doesn't compete with the search icon.
export function SearchBar({
  value,
  onChangeText,
  onOpenFilters,
  filterActive,
  placeholder,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onOpenFilters?: () => void;
  filterActive?: boolean;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
      <Ionicons name="search" size={18} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        className="ml-2 flex-1 text-sm text-gray-900"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} className="ml-1 opacity-40">
          <Ionicons name="close-circle" size={18} color="#374151" />
        </Pressable>
      )}
      {onOpenFilters && (
        <Pressable onPress={onOpenFilters} hitSlop={8} className="ml-2">
          <Ionicons name="options-outline" size={18} color={filterActive ? '#EA580C' : '#9CA3AF'} />
        </Pressable>
      )}
    </View>
  );
}
