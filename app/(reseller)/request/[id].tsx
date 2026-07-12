// app/(reseller)/request/[id].tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';
import { RequestDetailsExtras } from '../../../lib/components/RequestDetailsExtras';
import { ChatThread } from '../../../lib/components/ChatThread';
import { distanceKm } from '../../../lib/utils/distance';
import type { ServiceRequest } from '../../../types/database.types';

function JobTracking({ request }: { request: ServiceRequest }) {
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleMarkPaid() {
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        values: { payment_status: 'paid', paid_at: new Date().toISOString() },
      });
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <View className="rounded-xl bg-white p-5">
        <Text className="text-sm uppercase tracking-wide text-gray-400">Status</Text>
        <Text className="mt-1 text-lg font-semibold capitalize text-blue-700">
          {request.status.replace('_', ' ')}
        </Text>
        {request.quoted_price != null && (
          <Text className="mt-2 text-sm text-gray-500">
            Quoted price: NPR {Number(request.quoted_price).toLocaleString()}
          </Text>
        )}
      </View>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <View className="mt-4 rounded-xl bg-white p-5">
        <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Payment</Text>
        <Text className="mb-3 text-sm text-gray-600">
          The client pays you directly — mark this paid once you've collected it.
        </Text>
        <View className="flex-row items-center justify-between">
          <View className={`rounded-full px-3 py-1.5 ${request.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
            <Text
              className={`text-xs font-bold ${
                request.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {request.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
          {request.payment_status !== 'paid' && request.status === 'resolved' && (
            <Pressable
              onPress={handleMarkPaid}
              disabled={updateRequest.isPending}
              className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">
                {updateRequest.isPending ? 'Updating…' : 'Mark as paid'}
              </Text>
            </Pressable>
          )}
        </View>
        {request.payment_status !== 'paid' && request.status !== 'resolved' && (
          <Text className="mt-2 text-xs text-gray-400">
            You can mark this as paid once the technician resolves the job.
          </Text>
        )}
      </View>

      <View className="mt-4">
        <Text className="mb-2 text-sm font-semibold text-gray-900">Message the client</Text>
        <ChatThread subjectType="service_request" subjectId={request.id} />
      </View>
    </ScrollView>
  );
}

export default function AssignTechnician() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [quotedPrice, setQuotedPrice] = useState('');

  const { data: request, isLoading: loadingRequest } = useSupabaseRow('service_requests', id);
  const { data: technicians, isLoading: loadingTechs } = useSupabaseQuery('profiles', {
    filters: { role: 'technician' },
  });
  const updateRequest = useSupabaseUpdate('service_requests');

  const requestLocation = request?.location_data;
  const rankedTechnicians = useMemo(() => {
    const list = technicians ?? [];
    const withDistance = list.map((t) => {
      const distance =
        requestLocation?.latitude != null &&
        requestLocation?.longitude != null &&
        t.latitude != null &&
        t.longitude != null
          ? distanceKm(
              { latitude: requestLocation.latitude, longitude: requestLocation.longitude },
              { latitude: t.latitude, longitude: t.longitude }
            )
          : null;
      return { ...t, distance };
    });
    return withDistance.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [technicians, requestLocation]);

  async function handleAssign(technicianId: string) {
    if (!userId || !id) return;
    try {
      await updateRequest.mutateAsync({
        id,
        values: {
          reseller_id: userId,
          technician_id: technicianId,
          status: 'assigned',
          quoted_price: quotedPrice.trim() ? Number(quotedPrice) : null,
        },
      });
      Alert.alert('Technician assigned', 'The job has been handed off.');
      router.replace('/(reseller)/requests');
    } catch (err) {
      Alert.alert('Could not assign', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  if (loadingRequest || !request) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  if (request.status !== 'pending') {
    if (request.reseller_id === userId) {
      return <JobTracking request={request} />;
    }
    return (
      <View className="flex-1 bg-gray-50 px-6 pt-16">
        <Text className="text-lg font-semibold text-gray-900">This request is already {request.status}.</Text>
        <Text className="mt-2 text-gray-500">Someone else may have claimed it already.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <View className="mt-4">
        <Text className="mb-2 text-sm font-semibold text-gray-900">Message the client for more details</Text>
        <ChatThread subjectType="service_request" subjectId={request.id} />
      </View>

      <Text className="mb-1 mt-6 text-sm font-medium text-gray-700">Quoted price (NPR, optional)</Text>
      <TextInput
        value={quotedPrice}
        onChangeText={setQuotedPrice}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Assign a technician</Text>
      <Text className="mb-3 text-xs text-gray-400">
        Sorted by availability{requestLocation?.latitude != null ? ' and distance' : ''}.
      </Text>

      {loadingTechs && <Text className="text-gray-500">Loading technicians…</Text>}
      {!loadingTechs && rankedTechnicians.length === 0 && (
        <Text className="text-gray-500">No technicians registered yet.</Text>
      )}

      {rankedTechnicians.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => handleAssign(item.id)}
          disabled={updateRequest.isPending}
          className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 disabled:opacity-50"
        >
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-gray-900">{item.full_name ?? 'Unnamed technician'}</Text>
              <View className={`rounded-full px-2 py-0.5 ${item.is_available ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Text className={`text-[10px] font-semibold ${item.is_available ? 'text-green-700' : 'text-gray-500'}`}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-gray-400">
              {item.distance != null ? `${item.distance.toFixed(1)} km away` : item.city ?? 'Location unknown'}
            </Text>
          </View>
          <Text className="font-semibold text-blue-700">Assign →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
