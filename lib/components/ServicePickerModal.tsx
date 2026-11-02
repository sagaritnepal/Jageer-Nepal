// lib/components/ServicePickerModal.tsx
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { useBackStep } from '../hooks/useBackStep';
import { CategoryBadge } from './CategoryBadge';

export type ServiceAction = 'Repair' | 'Installation';
const ACTIONS: ServiceAction[] = ['Repair', 'Installation'];

/** Picks what a job is for - the service, and whether it is a repair or an installation - from inside the job's
 * own form, so starting a job opens the form straight away instead of a page of services first. */
export function ServicePickerModal({
  visible,
  initialAction = 'Repair',
  onPick,
  onClose,
}: {
  visible: boolean;
  initialAction?: ServiceAction;
  onPick: (category: string, action: ServiceAction) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<ServiceAction>(initialAction);
  const [query, setQuery] = useState('');
  const { data: categories, isLoading } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });
  useBackStep(visible, close);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => c.label.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  }, [categories, query]);

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={close}>
        <Pressable onPress={() => {}} className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 560, maxHeight: '86%' }}>
          <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
            <Text className="flex-1 text-base font-bold text-gray-900">Choose a service</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>
          </View>

          <View className="gap-2.5 px-4 pb-2 pt-3">
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
                placeholder="Search - CCTV, AC, printer, WiFi…"
                placeholderTextColor="#9CA3AF"
                className="flex-1 py-2.5 text-base text-gray-900"
              />
              {!!query && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}>
            {isLoading && <Text className="px-3 py-4 text-sm text-gray-500">Loading services…</Text>}
            {!isLoading && shown.length === 0 && <Text className="px-3 py-4 text-sm text-gray-500">No service matches that search.</Text>}
            {shown.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setQuery('');
                  onPick(c.label, action);
                }}
                className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-gray-50"
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
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
