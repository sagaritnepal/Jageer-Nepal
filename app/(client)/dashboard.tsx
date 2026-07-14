// app/(client)/dashboard.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { CategoryGrid } from '../../lib/components/CategoryGrid';

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
  const [search, setSearch] = useState('');

  const { data: technicians } = useSupabaseQuery('profiles', {
    filters: { role: 'technician', is_active: true },
  });
  const nearbyTechnicians = technicians?.slice(0, 3) ?? [];

  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-6 pb-2 pt-16">
        <Text className="text-2xl font-extrabold text-gray-900">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </Text>
      </View>

      <View className="px-6 pt-3">
        <View className="mb-4 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for services..."
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-sm text-gray-900"
          />
        </View>

        <Pressable
          onPress={() => router.push('/(client)/new-request')}
          className="mb-5 flex-row items-center justify-between rounded-2xl bg-orange-500 px-4 py-3.5"
        >
          <View>
            <Text className="text-[14.5px] font-bold text-white">Need IT help?</Text>
            <Text className="mt-0.5 text-xs text-orange-100">Report an issue in seconds</Text>
          </View>
          <View className="rounded-full bg-white px-4 py-2">
            <Text className="text-xs font-bold text-orange-600">Request</Text>
          </View>
        </Pressable>

        <Text className="mb-3 text-[15px] font-bold text-gray-900">Browse by category</Text>
        <CategoryGrid
          categories={filteredCategories}
          onSelect={(c) => router.push(`/(client)/new-request?category=${encodeURIComponent(c.label)}`)}
        />

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
