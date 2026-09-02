// lib/components/ServiceActionSheet.tsx
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBadge } from './CategoryBadge';
import type { ServiceCategory } from '../../types/database.types';

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

const ACTION_META: Record<(typeof SERVICE_ACTIONS)[number], { icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  Repair: { icon: 'build-outline', desc: "Something's broken or not working right" },
  Installation: { icon: 'cube-outline', desc: 'Setting up something new' },
};

export function ServiceActionSheet({
  category,
  onSelect,
  onClose,
}: {
  category: ServiceCategory | null;
  onSelect: (action: (typeof SERVICE_ACTIONS)[number]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!category} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-white px-6 pt-3"
          style={{ paddingBottom: insets.bottom + 28 }}
          onPress={() => {}}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-gray-200" />

          <View className="mb-4 flex-row items-center gap-3">
            <CategoryBadge
              category={category?.label}
              categoryId={category?.id}
              visualKey={category?.visual_key}
              emoji={category?.icon}
              size={48}
            />
            <View className="flex-1">
              <Text className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Selected service</Text>
              <Text className="text-base font-extrabold text-gray-900">{category?.label}</Text>
            </View>
          </View>

          <Text className="mb-3.5 text-[13px] text-gray-500">What do you need done?</Text>

          <View className="gap-2.5">
            {SERVICE_ACTIONS.map((a) => {
              const meta = ACTION_META[a];
              return (
                <Pressable
                  key={a}
                  onPress={() => onSelect(a)}
                  className="flex-row items-center gap-3.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    <Ionicons name={meta.icon} size={20} color="#6B7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14.5px] font-bold text-gray-900">{a}</Text>
                    <Text className="mt-0.5 text-xs text-gray-500">{meta.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
