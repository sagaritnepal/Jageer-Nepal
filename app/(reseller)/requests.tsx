// app/(reseller)/requests.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function ResellerRequestQueue() {
  const { data: requests, isLoading } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending' },
    orderBy: { column: 'created_at', ascending: true },
  });

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Request Queue</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && requests?.length === 0 && (
        <Text className="text-gray-500">No pending requests right now.</Text>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(reseller)/request/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">{item.issue_type}</Text>
            <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
              {item.description}
            </Text>
            <Text className="mt-2 text-xs uppercase tracking-wide text-amber-600">Pending — needs a technician</Text>
          </Pressable>
        )}
      />

      {/* Note: quotation/pricing step is not built yet — this queue goes
          straight from "pending" to "assigned" once a technician is picked. */}
    </View>
  );
}
