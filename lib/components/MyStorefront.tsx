// lib/components/MyStorefront.tsx
import { View, Text, Image } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import type { Product, UserRole } from '../../types/database.types';

function StorefrontCard({ item }: { item: Product }) {
  const outOfStock = item.stock_level <= 0;

  return (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3">
      <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-3xl">🖥️</Text>
        )}
        {outOfStock && (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <Text className="text-xs font-bold text-white">OUT OF STOCK</Text>
          </View>
        )}
      </View>

      {item.category && (
        <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
      )}
      <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="text-base font-bold text-gray-900">NPR {Number(item.price).toLocaleString()}</Text>
      <Text className="mt-0.5 text-xs text-gray-400">
        {outOfStock ? 'Out of stock' : `${item.stock_level} in stock`}
      </Text>
    </View>
  );
}

export function MyStorefront({
  sellerRole,
  note,
  emptyText,
}: {
  sellerRole: UserRole;
  note: string;
  emptyText: string;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: products, isLoading } = useSupabaseQuery('products', {
    filters: { seller_id: userId ?? '', seller_role: sellerRole },
    enabled: !!userId,
  });

  const listed = products ?? [];
  const totalStock = listed.reduce((sum, p) => sum + p.stock_level, 0);
  const totalValue = listed.reduce((sum, p) => sum + p.stock_level * Number(p.price), 0);

  return (
    <>
      <Text className="mb-4 text-sm text-gray-500">{note}</Text>
      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && listed.length === 0 && <Text className="text-gray-500">{emptyText}</Text>}
      {!isLoading && listed.length > 0 && (
        <View className="mb-4 flex-row justify-between rounded-xl border border-gray-200 bg-white p-4">
          <View>
            <Text className="text-xs text-gray-400">Total stock on hand</Text>
            <Text className="text-lg font-bold text-gray-900">{totalStock} units</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-gray-400">Total stock value</Text>
            <Text className="text-lg font-bold text-gray-900">NPR {totalValue.toLocaleString()}</Text>
          </View>
        </View>
      )}
      <View className="flex-row flex-wrap justify-between">
        {listed.map((item) => (
          <StorefrontCard key={item.id} item={item} />
        ))}
      </View>
    </>
  );
}
