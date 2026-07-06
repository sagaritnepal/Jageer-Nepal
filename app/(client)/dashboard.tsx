// app/(client)/dashboard.tsx
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600',
  assigned: 'text-blue-700',
  in_progress: 'text-blue-700',
  resolved: 'text-green-600',
  cancelled: 'text-gray-400',
};

export default function ClientDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: requests } = useSupabaseQuery('service_requests', {
    filters: userId ? { client_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const recentRequests = requests?.slice(0, 3) ?? [];

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </Text>
      <Text className="mb-8 text-gray-500">What do you need help with today?</Text>

      <Pressable
        onPress={() => router.push('/(client)/new-request')}
        className="mb-3 rounded-xl bg-blue-700 p-5"
      >
        <Text className="text-lg font-semibold text-white">Request a repair</Text>
        <Text className="mt-1 text-blue-100">Get a technician assigned to your issue</Text>
      </Pressable>

      {recentRequests.length > 0 && (
        <View className="mt-4">
          <Text className="mb-2 text-sm font-semibold text-gray-900">Recent requests</Text>
          {recentRequests.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/(client)/request/${r.id}`)}
              className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
            >
              <Text className="font-semibold text-gray-900">{r.issue_type}</Text>
              <Text className={`mt-1 text-sm capitalize ${STATUS_COLORS[r.status] ?? 'text-gray-500'}`}>
                {r.status.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/(client)/requests')} className="mb-2">
            <Text className="text-sm font-semibold text-blue-700">View all requests →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
