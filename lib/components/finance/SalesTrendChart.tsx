// lib/components/finance/SalesTrendChart.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import type { Order } from '../../../types/database.types';

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

export function SalesTrendChart() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: salesOrders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const [period, setPeriod] = useState<Period>('day');
  const buckets = useMemo(() => bucketOrders(salesOrders ?? [], period), [salesOrders, period]);
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
