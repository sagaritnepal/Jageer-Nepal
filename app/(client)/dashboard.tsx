// app/(client)/dashboard.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

const CATEGORY_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
];

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ClientDashboard() {
  const profile = useAuthStore((state) => state.profile);

  const { data: technicians } = useSupabaseQuery('profiles', {
    filters: { role: 'technician', is_active: true },
  });
  const nearbyTechnicians = technicians?.slice(0, 3) ?? [];

  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="rounded-b-[22px] bg-blue-700 px-6 pb-6 pt-16">
        <Text className="text-[19px] font-extrabold text-white">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </Text>

        <Pressable
          onPress={() => router.push('/(client)/new-request')}
          className="mt-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3.5"
        >
          <View>
            <Text className="text-[14.5px] font-bold text-gray-900">Need IT help?</Text>
            <Text className="mt-0.5 text-xs text-gray-500">Report an issue in seconds</Text>
          </View>
          <View className="rounded-full bg-blue-700 px-4 py-2">
            <Text className="text-xs font-bold text-white">Request</Text>
          </View>
        </Pressable>
      </View>

      <View className="px-6 pt-5">
        <Text className="mb-3 text-[15px] font-bold text-gray-900">Browse by category</Text>
        <View className="flex-row flex-wrap">
          {(categories ?? []).map((c, i) => {
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(client)/new-request?category=${encodeURIComponent(c.label)}`)}
                className="mb-5 w-1/4 items-center px-1"
              >
                <View className={`h-14 w-14 items-center justify-center rounded-2xl ${color.bg}`}>
                  <Text className="text-2xl">{c.icon}</Text>
                </View>
                <Text
                  numberOfLines={2}
                  className="mt-2 text-center text-[11.5px] font-semibold leading-[1.2] text-gray-800"
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {nearbyTechnicians.length > 0 && (
          <>
            <Text className="mb-3 mt-3 text-[15px] font-bold text-gray-900">Nearby technicians</Text>
            {nearbyTechnicians.map((tech) => (
              <View
                key={tech.id}
                className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-teal-600">
                  <Text className="text-xs font-bold text-white">{initialsOf(tech.full_name)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold text-gray-900">{tech.full_name ?? 'Technician'}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-gray-400">
                    {tech.city ?? 'Nepal'} · Available now
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
