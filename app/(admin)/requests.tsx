// app/(admin)/requests.tsx
import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { distanceKm } from '../../lib/utils/distance';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import type { Profile, RequestStatus, ServiceRequest } from '../../types/database.types';

function StatusPill({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function RequestCard({ item, profileMap }: { item: ServiceRequest; profileMap: Map<string, Profile> }) {
  const client = profileMap.get(item.client_id);
  const technician = item.technician_id ? profileMap.get(item.technician_id) : null;
  const reseller = item.reseller_id ? profileMap.get(item.reseller_id) : null;

  const customerName = item.customer_name ?? client?.full_name;
  const customerPhone = item.customer_phone ?? client?.phone;

  const distance =
    item.location_data?.latitude != null &&
    item.location_data?.longitude != null &&
    technician?.latitude != null &&
    technician?.longitude != null
      ? distanceKm(
          { latitude: item.location_data.latitude, longitude: item.location_data.longitude },
          { latitude: technician.latitude, longitude: technician.longitude }
        )
      : null;

  return (
    <View className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
        <StatusPill status={item.status} />
      </View>
      {item.description && (
        <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <View className={`rounded-full px-2 py-0.5 ${item.origin === 'app' ? 'bg-blue-50' : 'bg-purple-50'}`}>
          <Text
            className={`text-[10px] font-semibold ${item.origin === 'app' ? 'text-blue-700' : 'text-purple-700'}`}
          >
            {item.origin === 'app' ? 'App customer' : 'Reseller-sourced'}
          </Text>
        </View>
        <View className={`rounded-full px-2 py-0.5 ${item.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
          <Text
            className={`text-[10px] font-semibold ${
              item.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
          </Text>
        </View>
      </View>

      <View className="mt-3 gap-1">
        {(customerName || customerPhone) && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Customer: </Text>
            {customerName ?? 'Unknown'}
            {customerPhone ? ` · ${customerPhone}` : ''}
          </Text>
        )}
        {reseller && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Reseller: </Text>
            {reseller.full_name ?? 'Unnamed'}
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
        {technician && (
          <Text className="text-xs text-gray-500">
            <Text className="font-medium text-gray-600">Technician: </Text>
            {technician.full_name ?? 'Unnamed'}
            {distance != null ? ` · ${distance.toFixed(1)} km from job` : ''}
          </Text>
        )}
        {item.remark && (
          <Text className="mt-1 text-xs italic text-gray-400" numberOfLines={2}>
            "{item.remark}"
          </Text>
        )}
      </View>
    </View>
  );
}

export default function AdminRequests() {
  const { data: requests, isLoading: loadingRequests } = useSupabaseQuery('service_requests', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const { data: profiles, isLoading: loadingProfiles } = useSupabaseQuery('profiles', {});

  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p])), [profiles]);
  const isLoading = loadingRequests || loadingProfiles;

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && requests?.length === 0 && <Text className="text-gray-500">No requests yet.</Text>}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RequestCard item={item} profileMap={profileMap} />}
      />
    </View>
  );
}
