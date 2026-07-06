// app/(admin)/reports.tsx
import { View, Text, ScrollView } from 'react-native';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <View className="mb-3 w-[48%] rounded-xl bg-white p-4">
      <Text className={`text-2xl font-bold ${accent ?? 'text-blue-700'}`}>{value}</Text>
      <Text className="mt-1 text-xs text-gray-500">{label}</Text>
    </View>
  );
}

export default function AdminReports() {
  const { data: orders, isLoading: loadingOrders } = useSupabaseQuery('orders', {});
  const { data: requests, isLoading: loadingRequests } = useSupabaseQuery('service_requests', {});
  const { data: profiles, isLoading: loadingProfiles } = useSupabaseQuery('profiles', {});
  const { data: products, isLoading: loadingProducts } = useSupabaseQuery('products', {});

  const isLoading = loadingOrders || loadingRequests || loadingProfiles || loadingProducts;

  // Revenue: sum of orders that aren't cancelled. Commission/platform-fee
  // tracking isn't in the schema yet — once you add a `commission_rate` or
  // `platform_fee` column to orders (or a firm-wide settings table), this is
  // where you'd calculate the platform's cut vs. seller payout.
  const totalRevenue =
    orders?.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

  const requestsByStatus = (requests ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const ordersByStatus = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const usersByRole = (profiles ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  const deadStockCount = (products ?? []).filter((p) => p.is_dead_stock).length;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading reports…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Financial & Platform Reports</Text>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Revenue</Text>
      <View className="mb-2 flex-row flex-wrap justify-between">
        <StatCard label="Total order revenue (NPR)" value={totalRevenue.toLocaleString()} />
        <StatCard label="Total orders" value={orders?.length ?? 0} />
      </View>

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Orders by status
      </Text>
      <View className="mb-2 flex-row flex-wrap justify-between">
        {Object.entries(ordersByStatus).map(([status, count]) => (
          <StatCard key={status} label={status} value={count} />
        ))}
        {orders?.length === 0 && <Text className="text-gray-500">No orders yet.</Text>}
      </View>

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Service requests by status
      </Text>
      <View className="mb-2 flex-row flex-wrap justify-between">
        {Object.entries(requestsByStatus).map(([status, count]) => (
          <StatCard key={status} label={status.replace('_', ' ')} value={count} />
        ))}
        {requests?.length === 0 && <Text className="text-gray-500">No requests yet.</Text>}
      </View>

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Users</Text>
      <View className="mb-2 flex-row flex-wrap justify-between">
        {Object.entries(usersByRole).map(([role, count]) => (
          <StatCard key={role} label={role} value={count} />
        ))}
      </View>

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Inventory</Text>
      <View className="mb-8 flex-row flex-wrap justify-between">
        <StatCard label="Total listed products" value={products?.length ?? 0} />
        <StatCard label="Dead stock items" value={deadStockCount} accent="text-amber-600" />
      </View>
    </ScrollView>
  );
}
