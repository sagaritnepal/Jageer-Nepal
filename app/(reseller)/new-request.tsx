// app/(reseller)/new-request.tsx
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { getCategoryVisual } from '../../lib/constants/categoryIcons';

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

export default function ResellerNewRequest() {
  const { category: presetCategory } = useLocalSearchParams<{ category?: string }>();

  const { data: categories, isLoading: loadingCategories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const [categoryOverride, setCategoryOverride] = useState<string | null>(presetCategory ?? null);
  const category = categoryOverride ?? categories?.[0]?.label ?? null;

  function goToDetails(action: (typeof SERVICE_ACTIONS)[number]) {
    if (!category) return;
    router.push(
      `/(reseller)/request-details?category=${encodeURIComponent(category)}&action=${encodeURIComponent(action)}`
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 100 }}>
      <Text className="mb-6 text-2xl font-bold text-gray-900">Request a technician</Text>

      <Text className="mb-2 text-sm font-medium text-gray-700">What do you need help with?</Text>
      {loadingCategories && <Text className="mb-4 text-gray-500">Loading categories…</Text>}
      <View className="mb-6 flex-row flex-wrap justify-between">
        {(categories ?? []).map((c) => {
          const isSelected = category === c.label;
          const { bg, icon } = getCategoryVisual(c.label);
          return (
            <View
              key={c.id}
              className={`mb-2.5 w-[48%] rounded-2xl border p-3.5 ${
                isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
              }`}
            >
              <Pressable onPress={() => setCategoryOverride(c.label)}>
                <View className={`h-11 w-11 items-center justify-center rounded-2xl ${bg}`}>
                  {icon ? <Ionicons name={icon} size={20} color="white" /> : <Text className="text-lg">{c.icon}</Text>}
                </View>
                <Text
                  className={`mt-2 text-[13px] font-bold leading-[1.25] ${
                    isSelected ? 'text-orange-600' : 'text-gray-900'
                  }`}
                >
                  {c.label}
                </Text>
                {c.description && <Text className="mt-0.5 text-[11px] text-gray-400">{c.description}</Text>}
              </Pressable>

              {isSelected && (
                <View className="mt-3 flex-row gap-1.5">
                  {SERVICE_ACTIONS.map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => goToDetails(a)}
                      className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-1.5"
                    >
                      <Text className="text-[11px] font-semibold text-gray-600">{a}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text className="text-xs text-gray-400">
        Tap Repair or Installation on a category above to continue with date, location, and photos.
      </Text>
    </ScrollView>
  );
}
