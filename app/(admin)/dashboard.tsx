// app/(admin)/dashboard.tsx
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import type { UserRole } from '../../types/database.types';

const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Clients',
  technician: 'Technicians',
  reseller: 'Resellers',
  wholesaler: 'Wholesalers',
  admin: 'Admins',
};

export default function AdminDashboard() {
  const { data: openRequests } = useSupabaseQuery('service_requests', { filters: { status: 'pending' } });
  const { data: allProducts } = useSupabaseQuery('products', {});
  const { data: orders } = useSupabaseQuery('orders', {});
  const { data: profiles } = useSupabaseQuery('profiles', {});
  const { data: reviews } = useSupabaseQuery('reviews', {});

  const platformRevenue = useMemo(
    () => (orders ?? []).reduce((sum, o) => sum + Number(o.platform_fee), 0),
    [orders]
  );
  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    (profiles ?? []).forEach((p) => {
      counts[p.role] = (counts[p.role] ?? 0) + 1;
    });
    return counts;
  }, [profiles]);
  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-8 text-2xl font-bold text-gray-900">Platform Overview</Text>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-2xl font-bold text-blue-700">NPR {platformRevenue.toLocaleString()}</Text>
          <Text className="text-sm text-gray-500">Platform revenue</Text>
        </View>
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-3xl font-bold text-blue-700">{openRequests?.length ?? 0}</Text>
          <Text className="text-sm text-gray-500">Pending requests</Text>
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-3xl font-bold text-blue-700">{allProducts?.length ?? 0}</Text>
          <Text className="text-sm text-gray-500">Listed products</Text>
        </View>
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-3xl font-bold text-blue-700">
            {averageRating != null ? `★ ${averageRating.toFixed(1)}` : '—'}
          </Text>
          <Text className="text-sm text-gray-500">Avg. technician rating</Text>
        </View>
      </View>

      <View className="rounded-xl bg-white p-5">
        <Text className="mb-3 text-sm font-semibold text-gray-900">Users by role</Text>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
          <View key={role} className="mb-1 flex-row justify-between">
            <Text className="text-sm text-gray-700">{ROLE_LABELS[role]}</Text>
            <Text className="text-sm text-gray-700">{usersByRole[role] ?? 0}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
