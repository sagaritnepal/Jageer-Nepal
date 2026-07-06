// app/(client)/requests.tsx
import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import type { RequestStatus } from '../../types/database.types';

type ViewMode = 'active' | 'history';

const ACTIVE_STATUSES: RequestStatus[] = ['pending', 'assigned', 'in_progress'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600',
  assigned: 'text-blue-700',
  in_progress: 'text-blue-700',
  resolved: 'text-green-600',
  cancelled: 'text-gray-400',
};

export default function ClientRequests() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  const { data: requests, isLoading } = useSupabaseQuery('service_requests', {
    filters: userId ? { client_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    const list = requests ?? [];
    return viewMode === 'active'
      ? list.filter((r) => ACTIVE_STATUSES.includes(r.status))
      : list.filter((r) => !ACTIVE_STATUSES.includes(r.status));
  }, [requests, viewMode]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <View className="mb-6 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">My Requests</Text>
        <Pressable
          onPress={() => router.push('/(client)/new-request')}
          className="rounded-lg bg-blue-700 px-4 py-2"
        >
          <Text className="font-semibold text-white">+ New</Text>
        </Pressable>
      </View>

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setViewMode('active')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'active' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'active' ? 'text-white' : 'text-gray-600'}`}>
            Active
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('history')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'history' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'history' ? 'text-white' : 'text-gray-600'}`}>
            History
          </Text>
        </Pressable>
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && filtered.length === 0 && (
        <Text className="text-gray-500">
          {viewMode === 'active' ? 'No active requests.' : 'No completed requests yet.'}
        </Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(client)/request/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">{item.issue_type}</Text>
            <Text className={`mt-1 text-sm capitalize ${STATUS_COLORS[item.status] ?? 'text-gray-500'}`}>
              {item.status.replace('_', ' ')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
