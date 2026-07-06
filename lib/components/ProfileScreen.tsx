// lib/components/ProfileScreen.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { ROLE_ACCENT } from '../constants/roleColors';

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function TechnicianRatingStat({ technicianId }: { technicianId: string }) {
  const { data: reviews } = useSupabaseQuery('reviews', { filters: { technician_id: technicianId } });

  const average = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="flex-1 items-center rounded-xl bg-white/15 px-2 py-2.5">
      <Text className="text-[14.5px] font-extrabold text-white">{average == null ? '—' : `★ ${average.toFixed(1)}`}</Text>
      <Text className="mt-0.5 text-center text-[10.5px] text-white/85">
        {reviews?.length ?? 0} review{(reviews?.length ?? 0) === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

export function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);

  const accent = (profile && ROLE_ACCENT[profile.role]) || ROLE_ACCENT.client;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View
        style={{ backgroundColor: accent }}
        className="items-center rounded-b-[22px] px-6 pb-7 pt-16"
      >
        <View className="h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <Text className="text-xl font-extrabold text-white">{initialsOf(profile?.full_name)}</Text>
        </View>
        <Text className="mt-2.5 text-lg font-extrabold text-white">{profile?.full_name ?? 'Your profile'}</Text>
        <Text className="mt-0.5 text-[12.5px] capitalize text-white/85">{profile?.role}</Text>

        {profile?.role === 'technician' ? (
          <View className="mt-4 w-full flex-row gap-2.5">
            <TechnicianRatingStat technicianId={profile.id} />
            <View className="flex-1 items-center rounded-xl bg-white/15 px-2 py-2.5">
              <Text className="text-[14.5px] font-extrabold text-white">{profile.city ?? '—'}</Text>
              <Text className="mt-0.5 text-[10.5px] text-white/85">Service area</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="px-6 pt-5">
        <View className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
          <Text className="text-sm text-gray-400">Phone</Text>
          <Text className="mb-3 text-gray-900">{profile?.phone ?? 'Not set'}</Text>
          <Text className="text-sm text-gray-400">City</Text>
          <Text className="text-gray-900">{profile?.city ?? 'Not set'}</Text>
        </View>

        <Pressable onPress={signOut} className="items-center rounded-xl border border-red-200 bg-red-50 py-3.5">
          <Text className="font-semibold text-red-600">Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
