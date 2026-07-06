// app/(technician)/dashboard.tsx
import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function TechnicianDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: jobs } = useSupabaseQuery('service_requests', {
    filters: userId ? { technician_id: userId } : {},
    enabled: !!userId,
  });
  const { data: reviews } = useSupabaseQuery('reviews', {
    filters: userId ? { technician_id: userId } : {},
    enabled: !!userId,
  });

  const todaysJobs = useMemo(
    () => (jobs ?? []).filter((j) => j.status === 'assigned' || j.status === 'in_progress'),
    [jobs]
  );
  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </Text>
      <Text className="mb-6 text-gray-500">
        {todaysJobs.length} active job{todaysJobs.length === 1 ? '' : 's'} right now
        {averageRating != null && ` · ★ ${averageRating.toFixed(1)}`}
      </Text>

      {todaysJobs.length === 0 ? (
        <Text className="text-gray-500">No jobs assigned yet. New assignments will show up here.</Text>
      ) : (
        todaysJobs.map((job) => (
          <Pressable
            key={job.id}
            onPress={() => router.push(`/(technician)/job/${job.id}`)}
            className="mb-2 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">{job.issue_type}</Text>
            <Text className="mt-1 text-sm capitalize text-blue-700">{job.status.replace('_', ' ')}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
