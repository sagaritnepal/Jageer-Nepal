// app/(reseller)/requests.tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { distanceKm } from '../../lib/utils/distance';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import { getCategoryVisual } from '../../lib/constants/categoryIcons';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import type { RequestStatus, ServiceRequest } from '../../types/database.types';

type ViewMode = 'incoming' | 'mine';

function StatusPill({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  const { bg, icon } = getCategoryVisual(category);
  return (
    <View className={`h-11 w-11 items-center justify-center rounded-2xl ${bg}`}>
      {icon ? (
        <Ionicons name={icon} size={20} color="white" />
      ) : (
        <Ionicons name="construct" size={20} color="white" />
      )}
    </View>
  );
}

function IncomingRequestCard({ item }: { item: ServiceRequest }) {
  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
      <Pressable onPress={() => router.push(`/(reseller)/request/${item.id}`)} className="flex-row items-start gap-3">
        <CategoryBadge category={item.issue_type} />
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
            <View className="rounded-full bg-amber-50 px-2 py-0.5">
              <Text className="text-[10px] font-semibold uppercase text-amber-600">Pending</Text>
            </View>
          </View>
          {item.description && (
            <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View className="mt-2 gap-1">
            {(item.scheduled_date || item.scheduled_time) && (
              <Text className="text-xs text-gray-500">
                {item.scheduled_date ?? 'Date TBD'} · {item.scheduled_time ?? 'Time TBD'}
              </Text>
            )}
            {item.location_data?.address && (
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {item.location_data.address}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={() => router.push(`/(reseller)/request/${item.id}`)}
          className="flex-1 items-center rounded-xl bg-teal-50 py-2.5"
        >
          <Text className="text-sm font-semibold text-teal-700">Assign Tech</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/(reseller)/request/${item.id}`)}
          className="flex-1 items-center rounded-xl bg-orange-500 py-2.5"
        >
          <Text className="text-sm font-semibold text-white">Accept Job</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MyRequestCard({ item }: { item: ServiceRequest }) {
  const needsCustomerLookup = item.origin === 'app' && !item.customer_name;
  const { data: customerProfile } = useSupabaseRow('profiles', needsCustomerLookup ? item.client_id : undefined);
  const { data: technicianProfile } = useSupabaseRow('profiles', item.technician_id ?? undefined);

  const customerName = item.customer_name ?? customerProfile?.full_name;
  const customerPhone = item.customer_phone ?? customerProfile?.phone;

  const distance =
    item.location_data?.latitude != null &&
    item.location_data?.longitude != null &&
    technicianProfile?.latitude != null &&
    technicianProfile?.longitude != null
      ? distanceKm(
          { latitude: item.location_data.latitude, longitude: item.location_data.longitude },
          { latitude: technicianProfile.latitude, longitude: technicianProfile.longitude }
        )
      : null;

  return (
    <Pressable
      onPress={() => router.push(`/(reseller)/request/${item.id}`)}
      className="mb-3 flex-row items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <CategoryBadge category={item.issue_type} />
      <View className="flex-1">
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
              {item.origin === 'app' ? 'App customer' : 'Your customer'}
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

        {technicianProfile && (
          <View className="mt-2.5 flex-row items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <PersonAvatar name={technicianProfile.full_name} photoUrl={technicianProfile.avatar_url} size={22} bg="bg-blue-600" />
            <Text className="flex-1 text-xs text-gray-600" numberOfLines={1}>
              Assigned to {technicianProfile.full_name ?? 'Unnamed'}
              {distance != null ? ` · ${distance.toFixed(1)} km away` : ''}
            </Text>
          </View>
        )}

        <View className="mt-2.5 gap-1">
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
      </View>
    </Pressable>
  );
}

export default function ResellerRequestQueue() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [viewMode, setViewMode] = useState<ViewMode>('incoming');

  const { data: incoming, isLoading: loadingIncoming } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    orderBy: { column: 'created_at', ascending: true },
  });

  const { data: mine, isLoading: loadingMine } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const requests = viewMode === 'incoming' ? incoming : mine;
  const isLoading = viewMode === 'incoming' ? loadingIncoming : loadingMine;

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-4 flex-row rounded-full bg-gray-100 p-1">
        <Pressable
          onPress={() => setViewMode('incoming')}
          className={`flex-1 items-center rounded-full py-2.5 ${viewMode === 'incoming' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'incoming' ? 'text-orange-600' : 'text-gray-500'}`}>
            Incoming ({incoming?.length ?? 0})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('mine')}
          className={`flex-1 items-center rounded-full py-2.5 ${viewMode === 'mine' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'mine' ? 'text-orange-600' : 'text-gray-500'}`}>
            My Jobs ({mine?.length ?? 0})
          </Text>
        </Pressable>
      </View>

      <Text className="mb-3 text-base font-bold text-gray-900">
        {viewMode === 'incoming' ? 'Incoming Requests' : 'My Jobs'}
      </Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && requests?.length === 0 && (
        <Text className="text-gray-500">
          {viewMode === 'incoming' ? 'No pending requests right now.' : "You haven't taken on any jobs yet."}
        </Text>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          viewMode === 'incoming' ? <IncomingRequestCard item={item} /> : <MyRequestCard item={item} />
        }
      />
    </View>
  );
}
