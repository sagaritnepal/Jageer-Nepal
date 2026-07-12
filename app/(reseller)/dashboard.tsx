// app/(reseller)/dashboard.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

const LOW_STOCK_THRESHOLD = 5;

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ResellerDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const { data: technicians } = useSupabaseQuery('profiles', {
    filters: { role: 'technician', is_active: true },
  });
  const nearbyTechnicians = technicians?.slice(0, 3) ?? [];

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });
  const { data: orders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });

  const revenue = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount), 0),
    [orders]
  );
  const deadStock = useMemo(() => (products ?? []).filter((p) => p.is_dead_stock), [products]);
  const lowStock = useMemo(
    () => (products ?? []).filter((p) => p.stock_level < LOW_STOCK_THRESHOLD),
    [products]
  );

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="rounded-b-[22px] bg-blue-700 px-6 pb-6 pt-16">
        <Text className="text-[19px] font-extrabold text-white">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </Text>

        <Pressable
          onPress={() => router.push('/(reseller)/new-request')}
          className="mt-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3.5"
        >
          <View>
            <Text className="text-[14.5px] font-bold text-gray-900">Need a technician?</Text>
            <Text className="mt-0.5 text-xs text-gray-500">Request one directly in seconds</Text>
          </View>
          <View className="rounded-full bg-blue-700 px-4 py-2">
            <Text className="text-xs font-bold text-white">Request</Text>
          </View>
        </Pressable>
      </View>

      <View className="px-6 pt-5">
        <Text className="mb-3 text-[15px] font-bold text-gray-900">Browse by category</Text>
        <View className="flex-row flex-wrap justify-between">
          {(categories ?? []).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/(reseller)/new-request?category=${encodeURIComponent(c.label)}`)}
              className="mb-2.5 w-[48%] rounded-2xl border border-gray-200 bg-white p-3.5"
            >
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Text className="text-base">{c.icon}</Text>
              </View>
              <Text className="mt-2 text-[13px] font-bold leading-[1.25] text-gray-900">{c.label}</Text>
              {c.description && <Text className="mt-0.5 text-[11px] text-gray-400">{c.description}</Text>}
            </Pressable>
          ))}
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

        <Text className="mb-3 mt-5 text-[15px] font-bold text-gray-900">Shop performance</Text>
        <View className="mb-2.5 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-white p-5">
            <Text className="text-2xl font-bold text-blue-700">NPR {revenue.toLocaleString()}</Text>
            <Text className="text-sm text-gray-500">Revenue</Text>
          </View>
          <View className="flex-1 rounded-xl bg-white p-5">
            <Text className="text-2xl font-bold text-blue-700">{lowStock.length}</Text>
            <Text className="text-sm text-gray-500">Low stock items</Text>
          </View>
        </View>

        {deadStock.length > 0 && (
          <Text className="mb-2.5 text-sm text-gray-500">{deadStock.length} item(s) flagged as dead stock</Text>
        )}

        {lowStock.length > 0 && (
          <View className="rounded-xl bg-white p-5">
            <Text className="mb-3 text-sm font-semibold text-gray-900">Low stock</Text>
            {lowStock.map((p) => (
              <View key={p.id} className="mb-1 flex-row justify-between">
                <Text className="text-sm text-gray-700">{p.name}</Text>
                <Text className="text-sm text-amber-600">{p.stock_level} left</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
