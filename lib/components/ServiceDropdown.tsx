// lib/components/ServiceDropdown.tsx
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { readKey } from '../utils/webKeys';
import { CategoryBadge } from './CategoryBadge';

export type ServiceAction = 'Repair' | 'Installation';
export interface ServiceChoice {
  category: string;
  action: string;
}
const ACTIONS: ServiceAction[] = ['Repair', 'Installation'];

/** What a job is for, chosen from inside the job's own form: a field that opens a list right under it (a dropdown,
 * not a pop-up) - Repair or Installation, a search box, then the services. Picking one closes it. */
export function ServiceDropdown({
  value,
  onChange,
}: {
  value: ServiceChoice | null;
  onChange: (category: string, action: ServiceAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ServiceAction>(value?.action === 'Installation' ? 'Installation' : 'Repair');
  const [query, setQuery] = useState('');
  const { data: categories, isLoading } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => c.label.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  }, [categories, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View className="mb-3" style={{ zIndex: 20 }}>
      <Pressable
        onPress={() => (open ? close() : setOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={value ? `Service: ${value.category}, ${value.action}. Change` : 'Choose a service'}
        accessibilityState={{ expanded: open }}
        className={`flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 ${
          open ? 'border-blue-600 bg-white' : value ? 'border-gray-200 bg-white' : 'border-dashed border-orange-300 bg-orange-50'
        }`}
        style={{ minHeight: 56 }}
      >
        {value ? (
          <>
            <CategoryBadge category={value.category} size={40} />
            <View className="flex-1" style={{ gap: 3 }}>
              <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>
                {value.category}
              </Text>
              <View className="self-start rounded-full border border-orange-200 bg-orange-50 px-2 py-px">
                <Text className="text-[11px] font-semibold text-orange-700">{value.action}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
              <Ionicons name="construct-outline" size={20} color="#EA580C" />
            </View>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="text-[15px] font-bold text-gray-900">Choose a service</Text>
              <Text className="text-xs text-gray-500">What does the technician need to do?</Text>
            </View>
          </>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
      </Pressable>

      {open && (
        <View className="mt-1.5 overflow-hidden rounded-2xl border border-gray-200 bg-white" style={{ maxHeight: 420 }}>
          <View className="gap-2.5 border-b border-gray-100 p-3">
            <View className="flex-row rounded-xl bg-gray-100 p-1">
              {ACTIONS.map((a) => {
                const on = action === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAction(a)}
                    accessibilityRole="button"
                    className={`h-10 flex-1 items-center justify-center rounded-lg ${on ? 'bg-white' : ''}`}
                  >
                    <Text className={`text-sm ${on ? 'font-bold text-blue-700' : 'font-semibold text-gray-500'}`}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3" style={{ minHeight: 44 }}>
              <Ionicons name="search" size={17} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onKeyPress={(e) => {
                  if (Platform.OS === 'web' && readKey(e).key === 'Escape') close();
                }}
                autoFocus={Platform.OS === 'web'}
                placeholder="Search - CCTV, AC, printer, WiFi…"
                placeholderTextColor="#9CA3AF"
                className="flex-1 py-2.5 text-base text-gray-900"
                // The row around it draws the border; the browser's own focus outline would double it.
                style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined}
              />
              {!!query && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 6 }}>
            {isLoading && <Text className="px-3 py-4 text-sm text-gray-500">Loading services…</Text>}
            {!isLoading && shown.length === 0 && <Text className="px-3 py-4 text-sm text-gray-500">No service matches that search.</Text>}
            {shown.map((c) => {
              const current = value?.category === c.label;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onChange(c.label, action);
                    close();
                  }}
                  className={`flex-row items-center gap-3 rounded-xl px-3 py-2 active:bg-gray-50 ${current ? 'bg-blue-50' : ''}`}
                  style={{ minHeight: 52 }}
                >
                  <CategoryBadge category={c.label} emoji={c.icon} categoryId={c.id} visualKey={c.visual_key} size={36} />
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-gray-900" numberOfLines={1}>
                      {c.label}
                    </Text>
                    {!!c.description && (
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        {c.description}
                      </Text>
                    )}
                  </View>
                  {current && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
