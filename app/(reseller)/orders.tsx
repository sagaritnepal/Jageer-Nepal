// app/(reseller)/orders.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function ResellerOrders() {
  const userId = useAuthStore((state) => state.session?.user.id);

  // Both orders placed (as buyer, via Shop) and received (as seller) show up here.
  const { data: orders, isLoading } = useSupabaseQuery('orders', {
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const myOrders = orders?.filter((o) => o.buyer_id === userId || o.seller_id === userId);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Orders</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && myOrders?.length === 0 && <Text className="text-gray-500">No orders yet.</Text>}

      <FlatList
        data={myOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(reseller)/order/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="text-xs text-gray-400">{item.seller_id === userId ? 'Selling' : 'Buying'}</Text>
            <Text className="font-semibold text-gray-900">
              NPR {Number(item.total_amount).toLocaleString()}
            </Text>
            <Text className="mt-1 text-sm capitalize text-blue-700">{item.status}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
