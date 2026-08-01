// lib/components/ShopOverviewSection.tsx
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';

function fmtAmount(n: number) {
  const rounded = Math.round(n);
  if (rounded >= 100000) return `NPR ${(rounded / 100000).toFixed(1)}L`;
  if (rounded >= 1000) return `NPR ${(rounded / 1000).toFixed(1)}k`;
  return `NPR ${rounded.toLocaleString()}`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-transparent bg-white p-3.5">
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{label}</Text>
    </View>
  );
}

export function ShopOverviewSection() {
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId, seller_role: 'reseller' } : {},
    enabled: !!userId,
  });

  const { itemTypes, totalUnits, stockValue } = useMemo(() => {
    const list = products ?? [];
    return {
      itemTypes: list.length,
      totalUnits: list.reduce((sum, p) => sum + p.stock_level, 0),
      stockValue: list.reduce((sum, p) => sum + p.stock_level * Number(p.price), 0),
    };
  }, [products]);

  return (
    <View className="mb-3 flex-row gap-2.5">
      <StatTile label="Item types" value={String(itemTypes)} />
      <StatTile label="Units in stock" value={String(totalUnits)} />
      <StatTile label="Stock value" value={fmtAmount(stockValue)} />
    </View>
  );
}
