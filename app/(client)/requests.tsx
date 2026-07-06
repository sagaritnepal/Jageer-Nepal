// app/(client)/requests.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function ClientRequests() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: requests, isLoading } = useSupabaseQuery('service_requests', {
    filters: userId ? { client_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

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

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && requests?.length === 0 && (
        <Text className="text-gray-500">No service requests yet.</Text>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(client)/request/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">{item.issue_type}</Text>
            <Text className="mt-1 text-sm capitalize text-blue-700">{item.status.replace('_', ' ')}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
