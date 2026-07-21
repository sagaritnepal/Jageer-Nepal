// app/(client)/requests.tsx
import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import type { RequestStatus, ServiceRequest } from '../../types/database.types';

type ViewMode = 'active' | 'history';

const ACTIVE_STATUSES: RequestStatus[] = ['pending', 'quoted', 'approved', 'assigned', 'in_progress'];

function StatusPill({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function ClientRequestCard({ item }: { item: ServiceRequest }) {
  const { data: technician } = useSupabaseRow('profiles', item.technician_id ?? undefined);

  return (
    <Pressable
      onPress={() => router.push(`/(client)/request/${item.id}`)}
      className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
        <StatusPill status={item.status} />
      </View>
      {item.description && (
        <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {item.status === 'resolved' && (
        <View className="mt-2 flex-row items-center gap-2">
          <View className={`rounded-full px-2 py-0.5 ${item.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
            <Text
              className={`text-[10px] font-semibold ${
                item.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {item.payment_status === 'paid' ? 'Payment received' : 'Payment due'}
            </Text>
          </View>
        </View>
      )}

      <View className="mt-3 gap-1">
        {(item.scheduled_date || item.scheduled_time) && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">When: </Text>
            {item.scheduled_date ?? 'Date TBD'} · {item.scheduled_time ?? 'Time TBD'}
          </Text>
        )}
        {item.location_data?.address && (
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            <Text className="font-medium text-gray-600">Address: </Text>
            {item.location_data.address}
          </Text>
        )}
        {item.quoted_price != null && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Price: </Text>
            NPR {Number(item.quoted_price).toLocaleString()}
          </Text>
        )}
        {technician && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Technician: </Text>
            {technician.full_name ?? 'Unnamed'}
            {technician.phone ? ` · ${technician.phone}` : ''}
          </Text>
        )}
        {item.remark && (
          <Text className="mt-1 text-xs italic text-gray-400" numberOfLines={2}>
            "{item.remark}"
          </Text>
        )}
      </View>
    </Pressable>
  );
}

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
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-6 flex-row items-center justify-end">
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
        renderItem={({ item }) => <ClientRequestCard item={item} />}
      />
    </View>
  );
}
