// app/(reseller)/shop.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { MyStorefront } from '../../lib/components/MyStorefront';

function StatTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <View className="flex-1 rounded-xl bg-white p-3.5">
      <Text className={`font-bold text-gray-900 ${compact ? 'text-[13px]' : 'text-lg'}`}>{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{label}</Text>
    </View>
  );
}

function ShopStats() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId, seller_role: 'reseller' } : {},
    enabled: !!userId,
  });
  const { data: orders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });

  const stats = useMemo(() => {
    const list = products ?? [];
    const itemTypes = list.length;
    const totalUnits = list.reduce((sum, p) => sum + p.stock_level, 0);
    const stockValue = list.reduce((sum, p) => sum + p.stock_level * Number(p.price), 0);
    const purchaseAmount = list.reduce((sum, p) => sum + p.purchased_stock * Number(p.purchase_price ?? 0), 0);
    const soldAmount = (orders ?? [])
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);
    return { itemTypes, totalUnits, stockValue, purchaseAmount, soldAmount };
  }, [products, orders]);

  // 3-across tiles are too narrow for "NPR 825,000" at a large single-line
  // size, so abbreviate above 100k (a truncated "…" was worse - the seller
  // couldn't tell 8 lakh from 80 lakh at a glance).
  const fmt = (n: number) => {
    const rounded = Math.round(n);
    if (rounded >= 100000) return `NPR ${(rounded / 100000).toFixed(1)}L`;
    if (rounded >= 1000) return `NPR ${(rounded / 1000).toFixed(1)}k`;
    return `NPR ${rounded.toLocaleString()}`;
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">Shop overview</Text>
      <View className="mb-2.5 flex-row gap-2.5">
        <StatTile label="Item types" value={String(stats.itemTypes)} />
        <StatTile label="Units in stock" value={String(stats.totalUnits)} />
      </View>
      <View className="flex-row gap-2.5">
        <StatTile compact label="Stock value" value={fmt(stats.stockValue)} />
        <StatTile compact label="Sold" value={fmt(stats.soldAmount)} />
        <StatTile compact label="Purchased" value={fmt(stats.purchaseAmount)} />
      </View>
    </View>
  );
}

export default function Shop() {
  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Pressable
        onPress={() => router.push('/(reseller)/wholesale')}
        className="mb-4 flex-row items-center justify-between rounded-xl bg-orange-500 px-4 py-3.5"
      >
        <View className="flex-row items-center gap-2.5">
          <Ionicons name="cart-outline" size={18} color="white" />
          <Text className="text-sm font-semibold text-white">Buy From Wholesaler</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="white" />
      </Pressable>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <ShopStats />

        <MyStorefront
          sellerRole="reseller"
          note="Everything you've bought from Wholesale stays visible here. Flip Available off to hide an item from customers without losing your stock count — you'll still see it, just customers won't."
          emptyText="Buy stock from a wholesaler and it'll show up here."
          basePath="/(reseller)"
        />
      </ScrollView>
    </View>
  );
}
