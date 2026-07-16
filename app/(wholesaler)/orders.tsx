// app/(wholesaler)/orders.tsx
import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { OrderCard } from '../../lib/components/OrderCard';

export default function WholesaleOrders() {
  const userId = useAuthStore((state) => state.session?.user.id);

  // Wholesalers only ever sell through this app (they source their own stock
  // outside it), so incoming orders are the ones where they're the seller.
  const { data: orders, isLoading } = useSupabaseQuery('orders', {
    filters: { seller_id: userId ?? '' },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: products } = useSupabaseQuery('products', {});

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Bulk Orders</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && orders?.length === 0 && <Text className="text-gray-500">No bulk orders yet.</Text>}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          userId ? (
            <OrderCard order={item} productMap={productMap} viewerId={userId} basePath="/(wholesaler)" />
          ) : null
        }
      />
    </View>
  );
}
