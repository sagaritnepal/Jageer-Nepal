// app/(client)/new-request.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useIsWideWeb } from '../../lib/hooks/useWideGrid';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { WideCardGrid } from '../../lib/components/web/WideCardGrid';

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

export default function NewRequest() {
  // `from` is the tab this form was opened from - carried through so
  // finishing the request lands back there (see returnPathOr).
  const { category: presetCategory, from } = useLocalSearchParams<{ category?: string; from?: string }>();
  const wide = useIsWideWeb();

  const { data: categories, isLoading: loadingCategories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  function goToDetails(category: string, action: (typeof SERVICE_ACTIONS)[number]) {
    router.push(
      `/(client)/request-details?category=${encodeURIComponent(category)}&action=${encodeURIComponent(action)}&n=${Date.now()}` +
        (from ? `&from=${encodeURIComponent(from)}` : '')
    );
  }

  return (
    <ScrollView
      className={wide ? 'flex-1 bg-gray-50 px-8 pt-5' : 'flex-1 bg-gray-50 px-6 pt-4'}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <Text className="mb-2 text-sm font-medium text-gray-700">What do you need help with?</Text>
      {loadingCategories && <Text className="mb-4 text-gray-500">Loading categories…</Text>}
      {/* On wide web the grid is its own row-wrapping box, so this wrapper only
          lays the phone's two-per-row cards out. */}
      <View className={wide ? 'mb-6' : 'mb-6 flex-row flex-wrap justify-between'}>
        <WideCardGrid cardWidth={260} minColumns={2} maxColumns={5}>
        {(categories ?? []).map((c) => {
          const isPreset = presetCategory === c.label;
          return (
            <View
              key={c.id}
              className={`mb-2.5 ${wide ? 'w-full' : 'w-[48%]'} rounded-2xl border p-3.5 ${
                isPreset ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
              }`}
            >
              <CategoryBadge category={c.label} emoji={c.icon} categoryId={c.id} visualKey={c.visual_key} />
              <Text
                className={`mt-2 text-[13px] font-bold leading-[1.25] ${
                  isPreset ? 'text-orange-600' : 'text-gray-900'
                }`}
              >
                {c.label}
              </Text>
              {c.description && <Text className="mt-0.5 text-[11px] text-gray-400">{c.description}</Text>}

              <View className="mt-3 flex-row gap-1.5">
                {SERVICE_ACTIONS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => goToDetails(c.label, a)}
                    className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-1.5"
                  >
                    <Text className="text-[11px] font-semibold text-gray-600">{a}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
        </WideCardGrid>
      </View>

      <Text className="text-xs text-gray-400">
        Tap Repair or Installation on a category to continue with date, location, and photos.
      </Text>
    </ScrollView>
  );
}
