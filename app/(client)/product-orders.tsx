// app/(client)/product-orders.tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function ClientProductOrders() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: orders, isLoading } = useSupabaseQuery('orders', {
    filters: userId ? { buyer_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">My Orders</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && orders?.length === 0 && <Text className="text-gray-500">No orders yet.</Text>}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(client)/order/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">NPR {Number(item.total_amount).toLocaleString()}</Text>
            <Text className="mt-1 text-sm capitalize text-blue-700">{item.status}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
