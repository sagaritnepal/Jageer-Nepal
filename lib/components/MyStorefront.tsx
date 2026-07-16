// lib/components/MyStorefront.tsx
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import type { Product, UserRole } from '../../types/database.types';

function StorefrontCard({ item, basePath }: { item: Product; basePath: string }) {
  const outOfStock = item.stock_level <= 0;
  const detailHref = item.catalog_id ? `${basePath}/catalog/${item.catalog_id}` : null;

  const card = (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-3xl">🖥️</Text>
        )}
        <View
          className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 ${
            outOfStock ? 'bg-gray-900/70' : 'bg-emerald-600/90'
          }`}
        >
          <Text className="text-[9px] font-bold uppercase tracking-wide text-white">
            {outOfStock ? 'Out of stock' : 'In stock'}
          </Text>
        </View>
      </View>

      {item.category && (
        <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
      )}
      <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="text-base font-bold text-gray-900">
        NPR {Number(item.price).toLocaleString()} <Text className="text-xs font-normal text-gray-400">/ unit</Text>
      </Text>

      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-gray-400">{outOfStock ? 'Restock to sell' : `${item.stock_level} on hand`}</Text>
        {detailHref && <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />}
      </View>
    </View>
  );

  if (!detailHref) return card;

  return <Pressable onPress={() => router.push(detailHref)}>{card}</Pressable>;
}

export function MyStorefront({
  sellerRole,
  note,
  emptyText,
  basePath,
}: {
  sellerRole: UserRole;
  note: string;
  emptyText: string;
  basePath: string;
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
      <View className="mb-5 flex-row items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3.5">
        <Ionicons name="eye-outline" size={18} color="#EA580C" />
        <Text className="flex-1 text-xs leading-5 text-orange-800">{note}</Text>
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      {!isLoading && listed.length === 0 && (
        <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-12">
          <Ionicons name="storefront-outline" size={36} color="#D1D5DB" />
          <Text className="mt-3 text-sm font-semibold text-gray-700">Nothing live yet</Text>
          <Text className="mt-1 px-8 text-center text-xs text-gray-400">{emptyText}</Text>
        </View>
      )}

      {!isLoading && listed.length > 0 && (
        <>
          <View className="mb-5 flex-row gap-3">
            <View className="flex-1 rounded-xl bg-white p-5">
              <Text className="text-2xl font-bold text-orange-600">{totalStock}</Text>
              <Text className="text-sm text-gray-500">Units on hand</Text>
            </View>
            <View className="flex-1 rounded-xl bg-white p-5">
              <Text className="text-2xl font-bold text-purple-700">NPR {totalValue.toLocaleString()}</Text>
              <Text className="text-sm text-gray-500">Stock value</Text>
            </View>
          </View>

          <Text className="mb-3 text-[15px] font-bold text-gray-900">Live listings ({listed.length})</Text>
          <View className="flex-row flex-wrap justify-between">
            {listed.map((item) => (
              <StorefrontCard key={item.id} item={item} basePath={basePath} />
            ))}
          </View>
        </>
      )}
    </>
  );
}
