// app/(wholesaler)/market.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

export default function WholesaleMarket() {
  const { data: products, isLoading } = useSupabaseQuery('products', {});

  const listings = useMemo(
    () => (products ?? []).filter((p) => p.wholesale_price != null),
    [products]
  );

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-1 text-2xl font-bold text-gray-900">Wholesale Market</Text>
      <Text className="mb-6 text-sm text-gray-500">Bulk pricing for verified buyers</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && listings.length === 0 && (
        <Text className="text-gray-500">No wholesale listings yet.</Text>
      )}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(wholesaler)/product/${item.id}`)}
            className="mb-3.5 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[14.5px] font-bold text-gray-900">{item.name}</Text>
              <View className="rounded-full bg-[#F1E9FE] px-2.5 py-1">
                <Text className="text-[10.5px] font-bold text-[#7C3AED]">MOQ {item.min_order_qty}</Text>
              </View>
            </View>
            <Text className="mt-2 text-[13px] text-gray-500">
              NPR {Number(item.wholesale_price).toLocaleString()} / unit · {item.stock_level} in stock
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
