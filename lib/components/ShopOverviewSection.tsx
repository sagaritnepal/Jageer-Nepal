// lib/components/ShopOverviewSection.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';

type TileKey = 'types' | 'units' | 'value';

function fmtAmount(n: number) {
  const rounded = Math.round(n);
  if (rounded >= 100000) return `NPR ${(rounded / 100000).toFixed(1)}L`;
  if (rounded >= 1000) return `NPR ${(rounded / 1000).toFixed(1)}k`;
  return `NPR ${rounded.toLocaleString()}`;
}

function StatTile({
  label,
  value,
  active = false,
  onPress,
}: {
  label: string;
  value: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl border p-3.5 ${active ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white'}`}
    >
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{label}</Text>
    </Pressable>
  );
}

function ShopStats({
  itemTypes,
  totalUnits,
  stockValue,
  selected,
  onSelect,
}: {
  itemTypes: number;
  totalUnits: number;
  stockValue: number;
  selected: TileKey | null;
  onSelect: (key: TileKey) => void;
}) {
  return (
    <View className="mb-4">
      <View className="flex-row gap-2.5">
        <StatTile label="Item types" value={String(itemTypes)} active={selected === 'types'} onPress={() => onSelect('types')} />
        <StatTile label="Units in stock" value={String(totalUnits)} active={selected === 'units'} onPress={() => onSelect('units')} />
        <StatTile label="Stock value" value={fmtAmount(stockValue)} active={selected === 'value'} onPress={() => onSelect('value')} />
      </View>
      <Text className="mt-2 text-xs text-gray-400">Tap any tile above to see your stock.</Text>
    </View>
  );
}

function StockDrilldown({ products }: { products: { id: string; name: string; category: string | null; stock_level: number; price: number }[] }) {
  return (
    <View className="mb-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">Your stock</Text>
      {products.length === 0 && <Text className="text-sm text-gray-500">No products in stock yet.</Text>}
      {products.map((p) => (
        <View key={p.id} className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
              {p.name}
            </Text>
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {p.category ?? 'Uncategorized'} · {p.stock_level} in stock
            </Text>
          </View>
          <Text className="text-sm font-extrabold text-gray-900">NPR {Number(p.price).toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

export function ShopOverviewSection() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [selected, setSelected] = useState<TileKey | null>(null);

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

  function handleSelect(key: TileKey) {
    setSelected((cur) => (cur === key ? null : key));
  }

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">Shop Overview</Text>
      <ShopStats
        itemTypes={itemTypes}
        totalUnits={totalUnits}
        stockValue={stockValue}
        selected={selected}
        onSelect={handleSelect}
      />

      {selected !== null && <StockDrilldown products={products ?? []} />}
    </View>
  );
}
