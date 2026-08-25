// lib/components/finance/InventoryScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useRole } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';

interface InventoryRow {
  key: string;
  name: string;
  price: number | null;
  stockLevel: number | null; // null = not a real catalog product, so no tracked stock level
  sold: number;
  purchased: number;
}

/** Stock list cross-referenced with Finance - each product's current stock
 * level next to how many units of it have actually moved through Sale and
 * Purchase bills (matched by item name, since a bill's line items are typed
 * or picked names, not a foreign key back to `products`). Also includes
 * items that only ever exist as a typed name in a bill (finance_items,
 * 0063_finance_items.sql) - a reseller can't add just any name to the real
 * product catalog (it's admin-curated), so plenty of what's actually bought
 * and sold only lives there, not in `products`. */
export function InventoryScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const role = useRole();
  const { data: products } = useSupabaseQuery('products', {
    filters: userId && role ? { seller_id: userId, seller_role: role } : {},
    orderBy: { column: 'name' },
    enabled: !!userId && !!role,
  });
  const { data: financeItems } = useSupabaseQuery('finance_items', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const [search, setSearch] = useState('');

  const rows = useMemo((): InventoryRow[] => {
    const soldByName = new Map<string, number>();
    const purchasedByName = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== 'sale' && t.type !== 'purchase') continue;
      const target = t.type === 'sale' ? soldByName : purchasedByName;
      for (const item of t.items) {
        const key = item.description.trim().toLowerCase();
        target.set(key, (target.get(key) ?? 0) + item.qty);
      }
    }

    const seenNames = new Set<string>();
    const productRows: InventoryRow[] = (products ?? []).map((product) => {
      const key = product.name.trim().toLowerCase();
      seenNames.add(key);
      return {
        key: `p-${product.id}`,
        name: product.name,
        price: Number(product.price),
        stockLevel: product.stock_level,
        sold: soldByName.get(key) ?? 0,
        purchased: purchasedByName.get(key) ?? 0,
      };
    });

    // A typed item that's never actually shown up in a bill (rate saved but
    // never used) isn't real inventory yet - only list ones with activity.
    const financeItemRows: InventoryRow[] = (financeItems ?? [])
      .filter((item) => !seenNames.has(item.name.trim().toLowerCase()))
      .map((item): InventoryRow | null => {
        const key = item.name.trim().toLowerCase();
        const sold = soldByName.get(key) ?? 0;
        const purchased = purchasedByName.get(key) ?? 0;
        if (sold === 0 && purchased === 0) return null;
        return {
          key: `f-${item.id}`,
          name: item.name,
          price: item.rate,
          stockLevel: null,
          sold,
          purchased,
        };
      })
      .filter((r): r is InventoryRow => r !== null);

    return [...productRows, ...financeItemRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, financeItems, transactions]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text className="text-base font-bold text-gray-900">Inventory</Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search your products"
        placeholderTextColor="#9CA3AF"
        className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      />

      <FlatList
        data={filteredRows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item: r }) => (
          <View className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="flex-1 pr-2 text-sm font-semibold text-gray-900" numberOfLines={1}>
                {r.name}
              </Text>
              {r.price != null && <Text className="text-sm font-extrabold text-gray-900">NPR {r.price.toLocaleString()}</Text>}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-lg bg-gray-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In Stock</Text>
                {r.stockLevel != null ? (
                  <Text className={`mt-0.5 text-sm font-bold ${r.stockLevel > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                    {r.stockLevel}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-sm font-bold text-gray-300">—</Text>
                )}
              </View>
              <View className="flex-1 rounded-lg bg-emerald-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Sold</Text>
                <Text className="mt-0.5 text-sm font-bold text-emerald-700">{r.sold}</Text>
              </View>
              <View className="flex-1 rounded-lg bg-blue-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Purchased</Text>
                <Text className="mt-0.5 text-sm font-bold text-blue-700">{r.purchased}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
            <Text className="mt-2 text-gray-500">{rows.length > 0 ? 'No matches.' : 'Nothing bought or sold yet.'}</Text>
          </View>
        }
      />
    </View>
  );
}
