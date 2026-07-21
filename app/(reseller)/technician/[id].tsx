// app/(reseller)/technician/[id].tsx
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../../lib/hooks/useSupabase';
import { STATUS_STYLES } from '../../../lib/constants/requestStatus';
import { getCategoryVisual } from '../../../lib/constants/categoryIcons';
import type { RequestStatus } from '../../../types/database.types';

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function StatusPill({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

export default function TechnicianWorkHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: technician, isLoading: loadingTech } = useSupabaseRow('profiles', id);
  const { data: history, isLoading: loadingHistory } = useSupabaseQuery('service_requests', {
    filters: userId && id ? { reseller_id: userId, technician_id: id } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId && !!id,
  });

  if (loadingTech || !technician) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-teal-600">
          <Text className="text-base font-bold text-white">{initialsOf(technician.full_name)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{technician.full_name ?? 'Technician'}</Text>
          <Text className="mt-0.5 text-sm text-gray-500">{technician.city ?? 'Nepal'}</Text>
          {technician.phone && <Text className="mt-0.5 text-sm text-gray-500">{technician.phone}</Text>}
        </View>
      </View>

      <Text className="mb-3 text-[15px] font-bold text-gray-900">Work history</Text>

      {loadingHistory && <Text className="text-gray-500">Loading…</Text>}
      {!loadingHistory && (history?.length ?? 0) === 0 && (
        <Text className="text-gray-500">No jobs with this technician yet.</Text>
      )}

      {(history ?? []).map((item) => {
        const { bg, icon } = getCategoryVisual(item.issue_type);
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/(reseller)/request/${item.id}`)}
            className="mb-3 flex-row items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <View className={`h-11 w-11 items-center justify-center rounded-2xl ${bg}`}>
              <Ionicons name={icon ?? 'construct'} size={20} color="white" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
                <StatusPill status={item.status} />
              </View>
              {item.customer_name && (
                <Text className="mt-1 text-sm text-gray-600" numberOfLines={1}>
                  Customer: {item.customer_name}
                </Text>
              )}
              <Text className="mt-1 text-xs text-gray-400">
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
