// app/(reseller)/request/[id].tsx
import { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';

export default function AssignTechnician() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [quotedPrice, setQuotedPrice] = useState('');

  const { data: request, isLoading: loadingRequest } = useSupabaseRow('service_requests', id);
  const { data: technicians, isLoading: loadingTechs } = useSupabaseQuery('profiles', {
    filters: { role: 'technician' },
  });
  const updateRequest = useSupabaseUpdate('service_requests');

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
    return (
      <View className="flex-1 bg-gray-50 px-6 pt-16">
        <Text className="text-lg font-semibold text-gray-900">This request is already {request.status}.</Text>
        <Text className="mt-2 text-gray-500">Someone else may have claimed it already.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-6 text-gray-600">{request.description}</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Quoted price (NPR, optional)</Text>
      <TextInput
        value={quotedPrice}
        onChangeText={setQuotedPrice}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">Assign a technician</Text>

      {loadingTechs && <Text className="text-gray-500">Loading technicians…</Text>}
      {!loadingTechs && technicians?.length === 0 && (
        <Text className="text-gray-500">No technicians registered yet.</Text>
      )}

      <FlatList
        data={technicians}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleAssign(item.id)}
            disabled={updateRequest.isPending}
            className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 disabled:opacity-50"
          >
            <Text className="font-semibold text-gray-900">{item.full_name ?? 'Unnamed technician'}</Text>
            <Text className="font-semibold text-blue-700">Assign →</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
