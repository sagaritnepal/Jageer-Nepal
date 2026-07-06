// app/(technician)/jobs.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

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

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(technician)/job/${item.id}`)}
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
