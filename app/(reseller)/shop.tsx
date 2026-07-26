// app/(reseller)/shop.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { MyStorefront } from '../../lib/components/MyStorefront';
import { OrderCard } from '../../lib/components/OrderCard';
import type { Order, Product } from '../../types/database.types';

type Tab = 'marketplace' | 'overview';
type Period = 'day' | 'week' | 'month';
type Drill = 'sold' | 'purchased' | null;

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
  compact = false,
  active = false,
  onPress,
}: {
  label: string;
  value: string;
  compact?: boolean;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl border p-3.5 ${active ? 'border-orange-500 bg-orange-50' : 'border-transparent bg-white'}`}
    >
      <Text className={`font-bold text-gray-900 ${compact ? 'text-[13px]' : 'text-lg'}`}>{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{label}</Text>
    </Pressable>
  );
}

function ShopStats({
  soldAmount,
  purchaseAmount,
  itemTypes,
  totalUnits,
  stockValue,
  drill,
  onSelectStock,
  onSelectSold,
  onSelectPurchased,
}: {
  soldAmount: number;
  purchaseAmount: number;
  itemTypes: number;
  totalUnits: number;
  stockValue: number;
  drill: Drill;
  onSelectStock: () => void;
  onSelectSold: () => void;
  onSelectPurchased: () => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">Shop overview</Text>
      <View className="mb-2.5 flex-row gap-2.5">
        <StatTile label="Item types" value={String(itemTypes)} onPress={onSelectStock} />
        <StatTile label="Units in stock" value={String(totalUnits)} onPress={onSelectStock} />
      </View>
      <View className="flex-row gap-2.5">
        <StatTile compact label="Stock value" value={fmtAmount(stockValue)} onPress={onSelectStock} />
        <StatTile compact label="Sold" value={fmtAmount(soldAmount)} active={drill === 'sold'} onPress={onSelectSold} />
        <StatTile
          compact
          label="Purchased"
          value={fmtAmount(purchaseAmount)}
          active={drill === 'purchased'}
          onPress={onSelectPurchased}
        />
      </View>
      <Text className="mt-2 text-xs text-gray-400">
        Tap Item types, Units, or Stock value to browse the Marketplace tab. Tap Sold or Purchased to see the orders behind that number.
      </Text>
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
    <View className="mb-4 rounded-xl bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-900">Sales trend</Text>
        <View className="flex-row rounded-lg border border-gray-300 bg-gray-50 p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 ${period === p ? 'bg-orange-500' : ''}`}
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
              className={`w-full rounded-t-md ${b.value > 0 ? 'bg-orange-500' : 'bg-gray-200'}`}
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

function OrderDrilldown({
  title,
  emptyText,
  orders,
  productMap,
  viewerId,
  roleLabel,
}: {
  title: string;
  emptyText: string;
  orders: Order[];
  productMap: Map<string, Product>;
  viewerId: string;
  roleLabel: string;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">{title}</Text>
      {orders.length === 0 && <Text className="text-sm text-gray-500">{emptyText}</Text>}
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} productMap={productMap} viewerId={viewerId} basePath="/(reseller)" roleLabel={roleLabel} />
      ))}
    </View>
  );
}

export default function Shop() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState<Tab>('marketplace');
  const [drill, setDrill] = useState<Drill>(null);

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId, seller_role: 'reseller' } : {},
    enabled: !!userId,
  });
  // Sales (this reseller as seller) and purchases (this reseller as buyer,
  // from a wholesaler) are the same `orders` table read from opposite sides -
  // both queried here so the Sold/Purchased tiles can drill into the real
  // order list instead of just showing a total.
  const { data: salesOrders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: purchaseOrders } = useSupabaseQuery('orders', {
    filters: userId ? { buyer_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: allProducts } = useSupabaseQuery('products', {});
  const productMap = useMemo(() => new Map((allProducts ?? []).map((p) => [p.id, p])), [allProducts]);

  const { itemTypes, totalUnits, stockValue, purchaseAmount } = useMemo(() => {
    const list = products ?? [];
    return {
      itemTypes: list.length,
      totalUnits: list.reduce((sum, p) => sum + p.stock_level, 0),
      stockValue: list.reduce((sum, p) => sum + p.stock_level * Number(p.price), 0),
      purchaseAmount: list.reduce((sum, p) => sum + p.purchased_stock * Number(p.purchase_price ?? 0), 0),
    };
  }, [products]);

  const soldAmount = useMemo(
    () => (salesOrders ?? []).filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0),
    [salesOrders]
  );

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

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setTab('marketplace')}
          className={`flex-1 items-center rounded-md py-2 ${tab === 'marketplace' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${tab === 'marketplace' ? 'text-white' : 'text-gray-600'}`}>
            Marketplace
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('overview')}
          className={`flex-1 items-center rounded-md py-2 ${tab === 'overview' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${tab === 'overview' ? 'text-white' : 'text-gray-600'}`}>
            Shop Overview
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === 'marketplace' ? (
          <MyStorefront
            sellerRole="reseller"
            note="Everything you've bought from Wholesale stays visible here. Flip Available off to hide an item from customers without losing your stock count — you'll still see it, just customers won't."
            emptyText="Buy stock from a wholesaler and it'll show up here."
            basePath="/(reseller)"
          />
        ) : (
          <>
            <ShopStats
              soldAmount={soldAmount}
              purchaseAmount={purchaseAmount}
              itemTypes={itemTypes}
              totalUnits={totalUnits}
              stockValue={stockValue}
              drill={drill}
              onSelectStock={() => setTab('marketplace')}
              onSelectSold={() => setDrill((d) => (d === 'sold' ? null : 'sold'))}
              onSelectPurchased={() => setDrill((d) => (d === 'purchased' ? null : 'purchased'))}
            />
            <SalesChart orders={salesOrders ?? []} />

            {drill === 'sold' && userId && (
              <OrderDrilldown
                title="Sales orders"
                emptyText="No sales yet."
                orders={salesOrders ?? []}
                productMap={productMap}
                viewerId={userId}
                roleLabel="Selling"
              />
            )}
            {drill === 'purchased' && userId && (
              <OrderDrilldown
                title="Purchase stock"
                emptyText="No wholesale purchases yet."
                orders={purchaseOrders ?? []}
                productMap={productMap}
                viewerId={userId}
                roleLabel="Buying"
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
