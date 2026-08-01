// lib/components/finance/FinanceDashboardScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { periodBuckets, formatBucketLabel, type Granularity } from './TrendChartCard';

const BLUE = '#2563EB';

function CircularProgress({
  percent,
  size = 44,
  strokeWidth = 4,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percent / 100);
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="white"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function shortcuts(basePath: string): {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}[] {
  return [
    { key: 'customers', label: 'Customers', icon: 'people', href: `${basePath}/customers` },
    { key: 'payment-in', label: 'Payment In', icon: 'arrow-down-circle', href: `${basePath}/quick-payment?type=in` },
    { key: 'payment-out', label: 'Payment Out', icon: 'arrow-up-circle', href: `${basePath}/quick-payment?type=out` },
    { key: 'sales', label: 'Sales', icon: 'trending-up', href: `${basePath}/transactions?type=sale&add=1` },
    { key: 'purchase', label: 'Purchase', icon: 'cart', href: `${basePath}/transactions?type=purchase&add=1` },
    { key: 'expenses', label: 'Expenses', icon: 'receipt', href: `${basePath}/transactions?type=expense&add=1` },
    { key: 'bank-accounts', label: 'Bank Accounts', icon: 'business', href: `${basePath}/bank-accounts` },
  ];
}

// Shows both cash IN and cash OUT for each day, side by side - a net-only
// bar can hide real volume (e.g. a big payment in and a big payment out the
// same day would net to ~zero and look like nothing happened).
function CashflowChart({
  data,
  formatLabel,
}: {
  data: { label: string; inAmt: number; outAmt: number }[];
  formatLabel?: (label: string, index: number) => string | null;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const HEIGHT = 110;
  const maxAmt = Math.max(1, ...data.map((d) => Math.max(d.inAmt, d.outAmt)));

  return (
    <View>
      <View className="flex-row items-end" style={{ height: HEIGHT, gap: 8 }}>
        {data.map((d, i) => {
          const inHeight = d.inAmt > 0 ? Math.max(3, (d.inAmt / maxAmt) * HEIGHT) : 0;
          const outHeight = d.outAmt > 0 ? Math.max(3, (d.outAmt / maxAmt) * HEIGHT) : 0;
          const isSelected = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(isSelected ? null : i)}
              className="flex-1 flex-row items-end justify-center"
              style={{ height: HEIGHT, gap: 3 }}
            >
              <View
                style={{ height: inHeight, backgroundColor: isSelected ? '#059669' : '#6ee7b7' }}
                className="flex-1 rounded-t"
              />
              <View
                style={{ height: outHeight, backgroundColor: isSelected ? '#dc2626' : '#fca5a5' }}
                className="flex-1 rounded-t"
              />
            </Pressable>
          );
        })}
      </View>
      <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
        {data.map((d, i) => {
          const label = formatLabel ? formatLabel(d.label, i) : d.label;
          return (
            <View key={i} className="flex-1 items-center">
              {label ? (
                <Text className="text-[9px] text-gray-400" numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {selected != null && (
        <View className="mt-2.5 self-start rounded-lg bg-gray-900 px-3 py-1.5">
          <Text className="text-xs font-semibold text-white">
            {data[selected].label}: In NPR {Math.round(data[selected].inAmt).toLocaleString()} · Out NPR{' '}
            {Math.round(data[selected].outAmt).toLocaleString()}
          </Text>
        </View>
      )}
      <View className="mt-2.5 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <Text className="text-[11px] text-gray-500">Cash in</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <Text className="text-[11px] text-gray-500">Cash out</Text>
        </View>
      </View>
    </View>
  );
}

export function FinanceDashboardScreen({ basePath }: { basePath: string }) {
  const isReseller = basePath === '/(reseller)';
  // Percentage widths (e.g. '31%') combined with a flex `gap` are computed
  // differently by React Native's native layout engine than by the browser,
  // so 3-across tiles that render correctly on web can wrap to 2 on a real
  // device. Computing an exact pixel width up front avoids that mismatch.
  const { width: screenWidth } = useWindowDimensions();
  const SCREEN_PADDING = 24; // px-6
  const GRID_GAP = 12; // gap-3
  const halfTileWidth = (screenWidth - SCREEN_PADDING * 2 - GRID_GAP) / 2;
  const thirdTileWidth = (screenWidth - SCREEN_PADDING * 2 - GRID_GAP * 2) / 3;
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useAuthStore((state) => state.profile);
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: allEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });

  const totals = useMemo(() => {
    const result = { sale: 0, purchase: 0, expense: 0 };
    for (const t of transactions ?? []) {
      result[t.type] += t.amount;
    }
    return result;
  }, [transactions]);

  const { toReceive, toGive } = useMemo(() => {
    const perCustomer: Record<string, number> = {};
    for (const e of allEntries ?? []) {
      perCustomer[e.customer_id] = (perCustomer[e.customer_id] ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount);
    }
    let receive = 0;
    let give = 0;
    for (const balance of Object.values(perCustomer)) {
      if (balance > 0) receive += balance;
      else give += -balance;
    }
    return { toReceive: receive, toGive: give };
  }, [allEntries]);

  const [cashflowGranularity, setCashflowGranularity] = useState<Granularity>('day');
  // Each bucket here renders two bars (in + out) side by side, so it needs
  // roughly half as many buckets as a single-bar chart to stay readable on
  // a phone screen - the default 30/12/12 buckets render as near-invisible
  // slivers once split in two.
  const CASHFLOW_BUCKET_COUNT: Record<Granularity, number> = { day: 10, week: 8, month: 6 };
  const cashflowBuckets = useMemo(
    () => periodBuckets(cashflowGranularity, CASHFLOW_BUCKET_COUNT[cashflowGranularity]),
    [cashflowGranularity]
  );

  // Same "received"/"paid" definition as yearReceived/yearPaid below - real
  // cash in is sales plus any payment collected (ledger credits); real cash
  // out is purchases, expenses, and manual Payment Out entries. Ledger-only
  // data would leave this empty for anyone whose activity is mostly plain
  // Sale/Purchase/Expense entries rather than manual ledger payments.
  const cashflow = useMemo(() => {
    return cashflowBuckets.map((b) => {
      const bucketTx = (transactions ?? []).filter((t) => {
        const tm = new Date(t.created_at).getTime();
        return tm >= b.start && tm < b.end;
      });
      const bucketEntries = (allEntries ?? []).filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= b.start && t < b.end;
      });
      const inAmt =
        bucketTx.filter((t) => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0) +
        bucketEntries.filter((e) => e.entry_type === 'credit').reduce((sum, e) => sum + e.amount, 0);
      const outAmt =
        bucketTx.filter((t) => t.type === 'purchase' || t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) +
        bucketEntries.filter((e) => e.entry_type === 'debit' && e.source === 'manual').reduce((sum, e) => sum + e.amount, 0);
      return { label: b.label, inAmt, outAmt };
    });
  }, [transactions, allEntries, cashflowBuckets]);

  // The combined cash-in-hand + bank balance across every account - every
  // sale, purchase, and expense already carries a payment mode (cash or a
  // specific bank account), so summing all of them together is exactly the
  // money actually on hand, live-updating as each one is recorded.
  const availableBalance = totals.sale - totals.purchase - totals.expense;

  // Matches TotalsReportScreen's definitions: "received" is every real cash
  // inflow (sales + any payment actually collected from a customer);
  // "paid" is every real cash outflow (purchases, expenses, and manual
  // Payment Out entries) - booking-sourced debit entries are excluded since
  // those represent a customer owing money, not the business paying it out.
  const { yearReceived, yearPaid } = useMemo(() => {
    const year = new Date().getFullYear();
    let received = 0;
    let paid = 0;
    for (const t of transactions ?? []) {
      if (new Date(t.created_at).getFullYear() !== year) continue;
      if (t.type === 'sale') received += t.amount;
      if (t.type === 'purchase' || t.type === 'expense') paid += t.amount;
    }
    for (const e of allEntries ?? []) {
      if (new Date(e.created_at).getFullYear() !== year) continue;
      if (e.entry_type === 'credit') received += e.amount;
      if (e.entry_type === 'debit' && e.source === 'manual') paid += e.amount;
    }
    return { yearReceived: received, yearPaid: paid };
  }, [transactions, allEntries]);

  const profileCompletion = useMemo(() => {
    const fields = [profile?.full_name, profile?.phone, profile?.avatar_url, profile?.city];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      {isReseller && (
        <Pressable
          onPress={() => router.push(`${basePath}/wholesale` as any)}
          className="mb-3 flex-row items-center justify-between rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: BLUE }}
        >
          <View className="flex-row items-center gap-2.5">
            <Ionicons name="cart-outline" size={18} color="white" />
            <Text className="text-sm font-semibold text-white">Buy From Wholesaler</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push(`${basePath}/transactions` as any)}
        className="mb-3 flex-row items-center justify-between rounded-2xl px-4 py-3.5"
        style={{ backgroundColor: BLUE }}
      >
        <View className="flex-row items-center gap-2.5">
          <Ionicons name="list-outline" size={18} color="white" />
          <Text className="text-sm font-semibold text-white">Transactions</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="white" />
      </Pressable>

      <View className="mb-3 flex-row gap-3">
        <View className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5" style={{ width: halfTileWidth }}>
          <Text className="text-xs font-semibold text-emerald-700">To Receive</Text>
          <Text className="mt-1 text-base font-extrabold text-emerald-700">NPR {toReceive.toLocaleString()}</Text>
        </View>
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3.5" style={{ width: halfTileWidth }}>
          <Text className="text-xs font-semibold text-red-600">To Give</Text>
          <Text className="mt-1 text-base font-extrabold text-red-600">NPR {toGive.toLocaleString()}</Text>
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-3">
        <Pressable
          onPress={() => router.push(`${basePath}/transactions?type=sale` as any)}
          className="flex-row items-center justify-between rounded-2xl bg-white p-3.5"
          style={{ width: halfTileWidth }}
        >
          <View>
            <Text className="text-xs font-semibold text-gray-500">Sales</Text>
            <Text className="mt-1 text-base font-extrabold text-emerald-600">NPR {totals.sale.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`${basePath}/transactions?type=purchase` as any)}
          className="flex-row items-center justify-between rounded-2xl bg-white p-3.5"
          style={{ width: halfTileWidth }}
        >
          <View>
            <Text className="text-xs font-semibold text-gray-500">Purchase</Text>
            <Text className="mt-1 text-base font-extrabold" style={{ color: BLUE }}>
              NPR {totals.purchase.toLocaleString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`${basePath}/transactions?type=expense` as any)}
          className="flex-row items-center justify-between rounded-2xl bg-white p-3.5"
          style={{ width: halfTileWidth }}
        >
          <View>
            <Text className="text-xs font-semibold text-gray-500">Expense</Text>
            <Text className="mt-1 text-base font-extrabold text-red-600">NPR {totals.expense.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`${basePath}/transactions` as any)}
          className="flex-row items-center justify-between rounded-2xl bg-white p-3.5"
          style={{ width: halfTileWidth }}
        >
          <View>
            <Text className="text-xs font-semibold text-gray-500">Available Balance</Text>
            <Text
              className="mt-1 text-base font-extrabold"
              style={{ color: availableBalance >= 0 ? BLUE : '#DC2626' }}
            >
              NPR {availableBalance.toLocaleString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
        </Pressable>
      </View>

      <View className="mb-3 flex-row gap-3">
        <Pressable
          onPress={() => router.push(`${basePath}/received` as any)}
          className="flex-1 flex-row items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5"
        >
          <View>
            <Text className="text-xs font-semibold text-emerald-700">Total Received</Text>
            <Text className="mt-1 text-base font-extrabold text-emerald-700">NPR {yearReceived.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#6EE7B7" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`${basePath}/paid` as any)}
          className="flex-1 flex-row items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3.5"
        >
          <View>
            <Text className="text-xs font-semibold text-red-600">Total Paid</Text>
            <Text className="mt-1 text-base font-extrabold text-red-600">NPR {yearPaid.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#FCA5A5" />
        </Pressable>
      </View>

      <Text className="mb-2 text-sm font-semibold text-gray-900">Shortcuts</Text>
      <View className="mb-4 flex-row flex-wrap gap-3">
        {shortcuts(basePath).map((s) => (
          <Pressable
            key={s.key}
            onPress={() => router.push(s.href as any)}
            className="items-center rounded-2xl border border-gray-200 bg-white py-4"
            style={{ width: thirdTileWidth }}
          >
            <View className="mb-1.5 h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name={s.icon} size={22} color={BLUE} />
            </View>
            <Text className="text-center text-xs font-semibold text-gray-700">{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {profileCompletion < 100 && (
        <Pressable onPress={() => router.push(`${basePath}/profile` as any)} className="mb-4 overflow-hidden rounded-2xl">
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}
          >
            <View style={{ width: 44, height: 44 }} className="items-center justify-center">
              <View style={{ position: 'absolute' }}>
                <CircularProgress percent={profileCompletion} />
              </View>
              <Text className="text-xs font-extrabold text-white">{profileCompletion}%</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-white">Complete your profile</Text>
              <Text className="mt-0.5 text-xs text-white/80">
                Add your remaining details so customers and technicians trust your business.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </LinearGradient>
        </Pressable>
      )}

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-3 text-sm font-semibold text-gray-900">Cashflow</Text>
        <View className="mb-3 flex-row gap-2">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => {
            const selectedG = cashflowGranularity === g;
            return (
              <Pressable
                key={g}
                onPress={() => setCashflowGranularity(g)}
                className={`flex-1 items-center rounded-full py-1.5 ${selectedG ? '' : 'border border-gray-200 bg-white'}`}
                style={selectedG ? { backgroundColor: BLUE } : undefined}
              >
                <Text className={`text-xs font-semibold capitalize ${selectedG ? 'text-white' : 'text-gray-600'}`}>{g}</Text>
              </Pressable>
            );
          })}
        </View>
        <CashflowChart
          data={cashflow}
          formatLabel={(label, i) => formatBucketLabel(cashflowGranularity, label, i, cashflow.length)}
        />
      </View>

      <Text className="text-center text-xs text-gray-400">
        Across {customers?.length ?? 0} customer{(customers?.length ?? 0) === 1 ? '' : 's'}
      </Text>
    </ScrollView>
  );
}
