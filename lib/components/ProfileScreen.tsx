// lib/components/ProfileScreen.tsx
import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';

function TechnicianRating({ technicianId }: { technicianId: string }) {
  const { data: reviews } = useSupabaseQuery('reviews', { filters: { technician_id: technicianId } });

  const average = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="mb-8 rounded-xl bg-white p-5">
      <Text className="text-sm text-gray-400">Rating</Text>
      {average == null ? (
        <Text className="text-gray-900">No ratings yet</Text>
      ) : (
        <Text className="text-gray-900">
          ★ {average.toFixed(1)} ({reviews!.length} review{reviews!.length === 1 ? '' : 's'})
        </Text>
      )}
    </View>
  );
}

export function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">{profile?.full_name ?? 'Your profile'}</Text>
      <Text className="mb-8 capitalize text-gray-500">{profile?.role}</Text>

      <View className="mb-8 rounded-xl bg-white p-5">
        <Text className="text-sm text-gray-400">Phone</Text>
        <Text className="mb-3 text-gray-900">{profile?.phone ?? 'Not set'}</Text>
        <Text className="text-sm text-gray-400">City</Text>
        <Text className="text-gray-900">{profile?.city ?? 'Not set'}</Text>
      </View>

      {profile?.role === 'technician' && <TechnicianRating technicianId={profile.id} />}

      <Pressable onPress={signOut} className="items-center rounded-lg border border-red-200 bg-red-50 py-3">
        <Text className="font-semibold text-red-600">Sign out</Text>
      </Pressable>
    </View>
  );
}
