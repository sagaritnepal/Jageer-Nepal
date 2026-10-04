// app/(admin)/reports.tsx
import { View, Text, ScrollView } from 'react-native';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useIsWideWeb } from '../../lib/hooks/useWideGrid';
import { WideCardGrid } from '../../lib/components/web/WideCardGrid';

/** `fill` makes the card take its whole cell instead of the phone layout's
 * fixed 48% (two to a row) - used by the wide web grid. */
function StatCard({
  label,
  value,
  accent,
  fill,
}: {
  label: string;
  value: string | number;
  accent?: string;
  fill?: boolean;
}) {
  return (
    <View className={`mb-3 ${fill ? 'w-full' : 'w-[48%]'} rounded-xl bg-white p-4`}>
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
  const wide = useIsWideWeb();

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

  // On wide web each group of stat cards flows across the page (as many to a
  // row as fit); on a phone they stay two to a row.
  const statGrid = (children: React.ReactNode, bottom: string) =>
    wide ? (
      <View className={bottom}>
        <WideCardGrid cardWidth={200} minColumns={2} maxColumns={6}>
          {children}
        </WideCardGrid>
      </View>
    ) : (
      <View className={`${bottom} flex-row flex-wrap justify-between`}>{children}</View>
    );

  return (
    <ScrollView className={wide ? 'flex-1 bg-gray-50 px-8 pt-5' : 'flex-1 bg-gray-50 px-6 pt-4'}>
      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Revenue</Text>
      {statGrid(
        [
          <StatCard key="revenue" fill={wide} label="Total order revenue (NPR)" value={totalRevenue.toLocaleString()} />,
          <StatCard key="orders" fill={wide} label="Total orders" value={orders?.length ?? 0} />,
        ],
        'mb-2'
      )}

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Orders by status
      </Text>
      {statGrid(
        [
          ...Object.entries(ordersByStatus).map(([status, count]) => (
            <StatCard key={status} fill={wide} label={status} value={count} />
          )),
          ...(orders?.length === 0 ? [<Text key="none" className="text-gray-500">No orders yet.</Text>] : []),
        ],
        'mb-2'
      )}

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Service requests by status
      </Text>
      {statGrid(
        [
          ...Object.entries(requestsByStatus).map(([status, count]) => (
            <StatCard key={status} fill={wide} label={status.replace('_', ' ')} value={count} />
          )),
          ...(requests?.length === 0 ? [<Text key="none" className="text-gray-500">No requests yet.</Text>] : []),
        ],
        'mb-2'
      )}

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Users</Text>
      {statGrid(
        Object.entries(usersByRole).map(([role, count]) => (
          <StatCard key={role} fill={wide} label={role} value={count} />
        )),
        'mb-2'
      )}

      <Text className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Inventory</Text>
      {statGrid(
        [
          <StatCard key="listed" fill={wide} label="Total listed products" value={products?.length ?? 0} />,
          <StatCard key="dead" fill={wide} label="Dead stock items" value={deadStockCount} accent="text-amber-600" />,
        ],
        'mb-8'
      )}
    </ScrollView>
  );
}
