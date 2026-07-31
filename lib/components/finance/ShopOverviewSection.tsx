// lib/components/finance/ShopOverviewSection.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import type { Order } from '../../../types/database.types';

type Period = 'day' | 'week' | 'month';
type Drill = 'stock' | null;

const PERIOD_LABELS: Record<Period, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const BUCKET_COUNT = 7;

function fmtAmount(n: number) {
  const rounded = Math.round(n);
  if (rounded >= 100000) return `NPR ${(rounded / 100000).toFixed(1)}L`;
  if (rounded >= 1000) return `NPR ${(rounded / 1000).toFixed(1)}k`;
  return `NPR ${rounded.toLocaleString()}`;
}

// Per-bar labels drop the "NPR" prefix (context already makes that clear)
// so the value fits in a ~50px chart column without truncating to "22…".
function fmtShort(n: number) {
  const rounded = Math.round(n);
  if (rounded >= 100000) return `${(rounded / 100000).toFixed(1)}L`;
  if (rounded >= 1000) return `${Math.round(rounded / 1000)}k`;
  return String(rounded);
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
  drill,
  onSelectStock,
}: {
  itemTypes: number;
  totalUnits: number;
  stockValue: number;
  drill: Drill;
  onSelectStock: () => void;
}) {
  const stockActive = drill === 'stock';
  return (
    <View className="mb-4">
      <View className="flex-row gap-2.5">
        <StatTile label="Item types" value={String(itemTypes)} active={stockActive} onPress={onSelectStock} />
        <StatTile label="Units in stock" value={String(totalUnits)} active={stockActive} onPress={onSelectStock} />
        <StatTile label="Stock value" value={fmtAmount(stockValue)} active={stockActive} onPress={onSelectStock} />
      </View>
      <Text className="mt-2 text-xs text-gray-400">Tap any tile above to see your stock.</Text>
    </View>
  );
}

// Groups this seller's non-cancelled orders into the last BUCKET_COUNT
// day/week/month periods (oldest first), summing total_amount per period -
// pure client-side aggregation since there's no revenue-by-period view in
// the database and the order volume here is small enough not to need one.
function bucketOrders(orders: Order[], period: Period): { key: string; label: string; value: number }[] {
  const now = new Date();
  const active = orders.filter((o) => o.status !== 'cancelled');
  const buckets: { key: string; label: string; value: number }[] = [];

  for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
    let start: Date;
    let end: Date;
    let label: string;

    if (period === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      label = start.toLocaleDateString(undefined, { weekday: 'short' });
    } else if (period === 'week') {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      label = `${start.getDate()}/${start.getMonth() + 1}`;
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      label = start.toLocaleDateString(undefined, { month: 'short' });
    }

    const value = active
      .filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    buckets.push({ key: start.toISOString(), label, value });
  }

  return buckets;
}

function SalesChart({ orders }: { orders: Order[] }) {
  const [period, setPeriod] = useState<Period>('day');
  const buckets = useMemo(() => bucketOrders(orders, period), [orders, period]);
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const total = buckets.reduce((sum, b) => sum + b.value, 0);

  return (
    <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-900">Sales trend</Text>
        <View className="flex-row rounded-lg border border-gray-300 bg-gray-50 p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 ${period === p ? 'bg-blue-600' : ''}`}
            >
              <Text className={`text-[11px] font-semibold ${period === p ? 'text-white' : 'text-gray-600'}`}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text className="mb-3 text-xs text-gray-400">
        Last {BUCKET_COUNT} {period === 'day' ? 'days' : period === 'week' ? 'weeks' : 'months'} · {fmtAmount(total)} total
      </Text>

      <View className="flex-row items-end justify-between gap-1.5" style={{ height: 130 }}>
        {buckets.map((b) => (
          <View key={b.key} className="flex-1 items-center">
            <Text className="mb-1 text-[9px] text-gray-500" numberOfLines={1}>
              {b.value > 0 ? fmtShort(b.value) : ''}
            </Text>
            <View
              className={`w-full rounded-t-md ${b.value > 0 ? 'bg-blue-600' : 'bg-gray-200'}`}
              style={{ height: Math.max(4, (b.value / max) * 84) }}
            />
            <Text className="mt-1 text-[9px] text-gray-500" numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        ))}
      </View>
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
  const [drill, setDrill] = useState<Drill>(null);

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId, seller_role: 'reseller' } : {},
    enabled: !!userId,
  });
  const { data: salesOrders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
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
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">Shop Overview</Text>
      <ShopStats
        itemTypes={itemTypes}
        totalUnits={totalUnits}
        stockValue={stockValue}
        drill={drill}
        onSelectStock={() => setDrill((d) => (d === 'stock' ? null : 'stock'))}
      />
      <SalesChart orders={salesOrders ?? []} />

      {drill === 'stock' && <StockDrilldown products={products ?? []} />}
    </View>
  );
}
