// app/(technician)/jobs.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import type { ServiceRequest } from '../../types/database.types';

function StatusPill({ status }: { status: ServiceRequest['status'] }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function JobListCard({ item }: { item: ServiceRequest }) {
  const needsCustomerLookup = !item.customer_name;
  const { data: customer } = useSupabaseRow('profiles', needsCustomerLookup ? item.client_id : undefined);
  const customerName = item.customer_name ?? customer?.full_name;
  const customerPhone = item.customer_phone ?? customer?.phone;

  return (
    <Pressable
      onPress={() => router.push(`/(technician)/job/${item.id}`)}
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

      <View className="mt-3 gap-1">
        {(customerName || customerPhone) && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Customer: </Text>
            {customerName ?? 'Unknown'}
            {customerPhone ? ` · ${customerPhone}` : ''}
          </Text>
        )}
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
        {item.remark && (
          <Text className="mt-1 text-xs italic text-gray-400" numberOfLines={2}>
            "{item.remark}"
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function TechnicianJobs() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: jobs, isLoading } = useSupabaseQuery('service_requests', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold text-gray-900">My Jobs</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && jobs?.length === 0 && <Text className="text-gray-500">No jobs assigned yet.</Text>}

      <FlatList data={jobs} keyExtractor={(item) => item.id} renderItem={({ item }) => <JobListCard item={item} />} />
    </View>
  );
}
