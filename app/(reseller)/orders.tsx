// app/(reseller)/orders.tsx
import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { OrderCard } from '../../lib/components/OrderCard';

export default function ResellerOrders() {
  const userId = useAuthStore((state) => state.session?.user.id);

  // Both orders placed (as buyer, via Shop) and received (as seller) show up here.
  const { data: orders, isLoading } = useSupabaseQuery('orders', {
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: products } = useSupabaseQuery('products', {});

  const myOrders = orders?.filter((o) => o.buyer_id === userId || o.seller_id === userId);
  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Orders</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && myOrders?.length === 0 && <Text className="text-gray-500">No orders yet.</Text>}

      <FlatList
        data={myOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          userId ? (
            <OrderCard
              order={item}
              productMap={productMap}
              viewerId={userId}
              basePath="/(reseller)"
              roleLabel={item.seller_id === userId ? 'Selling' : 'Buying'}
            />
          ) : null
        }
      />
    </View>
  );
}
