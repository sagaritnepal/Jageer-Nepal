// app/(reseller)/dashboard.tsx
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

const LOW_STOCK_THRESHOLD = 5;

export default function ResellerDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);

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
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </Text>
      <Text className="mb-6 text-gray-500">
        {deadStock.length > 0 ? `${deadStock.length} item(s) flagged as dead stock` : 'No dead stock flagged'}
      </Text>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-2xl font-bold text-blue-700">NPR {revenue.toLocaleString()}</Text>
          <Text className="text-sm text-gray-500">Revenue</Text>
        </View>
        <View className="flex-1 rounded-xl bg-white p-5">
          <Text className="text-2xl font-bold text-blue-700">{lowStock.length}</Text>
          <Text className="text-sm text-gray-500">Low stock items</Text>
        </View>
      </View>

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
  );
}
