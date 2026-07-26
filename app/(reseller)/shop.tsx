// app/(reseller)/shop.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { MyStorefront } from '../../lib/components/MyStorefront';
import type { Order } from '../../types/database.types';

type Tab = 'marketplace' | 'overview';
type Period = 'day' | 'week' | 'month';

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

function StatTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <View className="flex-1 rounded-xl bg-white p-3.5">
      <Text className={`font-bold text-gray-900 ${compact ? 'text-[13px]' : 'text-lg'}`}>{value}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{label}</Text>
    </View>
  );
}

function ShopStats({ orders, purchaseAmount, itemTypes, totalUnits, stockValue }: {
  orders: Order[];
  purchaseAmount: number;
  itemTypes: number;
  totalUnits: number;
  stockValue: number;
}) {
  const soldAmount = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0),
    [orders]
  );

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-900">Shop overview</Text>
      <View className="mb-2.5 flex-row gap-2.5">
        <StatTile label="Item types" value={String(itemTypes)} />
        <StatTile label="Units in stock" value={String(totalUnits)} />
      </View>
      <View className="flex-row gap-2.5">
        <StatTile compact label="Stock value" value={fmtAmount(stockValue)} />
        <StatTile compact label="Sold" value={fmtAmount(soldAmount)} />
        <StatTile compact label="Purchased" value={fmtAmount(purchaseAmount)} />
      </View>
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

export default function Shop() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState<Tab>('marketplace');

  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId, seller_role: 'reseller' } : {},
    enabled: !!userId,
  });
  const { data: orders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });

  const { itemTypes, totalUnits, stockValue, purchaseAmount } = useMemo(() => {
    const list = products ?? [];
    return {
      itemTypes: list.length,
      totalUnits: list.reduce((sum, p) => sum + p.stock_level, 0),
      stockValue: list.reduce((sum, p) => sum + p.stock_level * Number(p.price), 0),
      purchaseAmount: list.reduce((sum, p) => sum + p.purchased_stock * Number(p.purchase_price ?? 0), 0),
    };
  }, [products]);

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
              orders={orders ?? []}
              purchaseAmount={purchaseAmount}
              itemTypes={itemTypes}
              totalUnits={totalUnits}
              stockValue={stockValue}
            />
            <SalesChart orders={orders ?? []} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
