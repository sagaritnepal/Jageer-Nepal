// lib/components/finance/FinanceDashboardScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { ShopOverviewSection } from './ShopOverviewSection';

const DAY_MS = 24 * 60 * 60 * 1000;
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
    { key: 'transactions', label: 'Transactions', icon: 'list', href: `${basePath}/transactions` },
    { key: 'sales', label: 'Sales', icon: 'trending-up', href: `${basePath}/transactions?type=sale` },
    { key: 'purchase', label: 'Purchase', icon: 'cart', href: `${basePath}/transactions?type=purchase` },
    { key: 'expenses', label: 'Expenses', icon: 'receipt', href: `${basePath}/transactions?type=expense` },
    { key: 'received', label: 'Total Received', icon: 'trending-up-outline', href: `${basePath}/received` },
    { key: 'paid', label: 'Total Paid', icon: 'trending-down-outline', href: `${basePath}/paid` },
    { key: 'bank-accounts', label: 'Bank Accounts', icon: 'business', href: `${basePath}/bank-accounts` },
  ];
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function CashflowChart({ data }: { data: { label: string; net: number }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const half = 56;
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));

  return (
    <View>
      <View className="relative flex-row" style={{ height: half * 2, gap: 6 }}>
        <View className="absolute left-0 right-0 h-px bg-gray-200" style={{ top: half }} />
        {data.map((d, i) => {
          const barHeight = d.net === 0 ? 0 : Math.max(3, (Math.abs(d.net) / maxAbs) * half);
          const isPositive = d.net >= 0;
          const isSelected = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(isSelected ? null : i)}
              className="flex-1"
              style={{ height: half * 2 }}
            >
              <View style={{ height: half, justifyContent: 'flex-end' }}>
                {isPositive && barHeight > 0 && (
                  <View
                    style={{ height: barHeight, backgroundColor: isSelected ? '#059669' : '#6ee7b7' }}
                    className="w-full rounded-t"
                  />
                )}
              </View>
              <View style={{ height: half, justifyContent: 'flex-start' }}>
                {!isPositive && barHeight > 0 && (
                  <View
                    style={{ height: barHeight, backgroundColor: isSelected ? '#dc2626' : '#fca5a5' }}
                    className="w-full rounded-b"
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-1.5 flex-row" style={{ gap: 6 }}>
        {data.map((d, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-[9px] text-gray-400">{d.label}</Text>
          </View>
        ))}
      </View>
      {selected != null && (
        <View className="mt-2.5 self-start rounded-lg bg-gray-900 px-3 py-1.5">
          <Text className="text-xs font-semibold text-white">
            {data[selected].label}: {data[selected].net >= 0 ? 'Net received ' : 'Net added '}
            NPR {Math.abs(data[selected].net).toLocaleString()}
          </Text>
        </View>
      )}
      <View className="mt-2.5 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <Text className="text-[11px] text-gray-500">Net received</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <Text className="text-[11px] text-gray-500">Net added (dues)</Text>
        </View>
      </View>
    </View>
  );
}

export function FinanceDashboardScreen({ basePath }: { basePath: string }) {
  const isReseller = basePath === '/(reseller)';
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

  const cashflow = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - (6 - i) * DAY_MS));
    return days.map((day) => {
      const dayStart = day.getTime();
      const dayEnd = dayStart + DAY_MS;
      const net = (allEntries ?? [])
        .filter((e) => {
          const t = new Date(e.created_at).getTime();
          return t >= dayStart && t < dayEnd;
        })
        .reduce((sum, e) => sum + (e.entry_type === 'credit' ? e.amount : -e.amount), 0);
      return { label: day.toLocaleDateString('en-US', { weekday: 'short' }), net };
    });
  }, [allEntries]);

  const netBalance = totals.sale - totals.purchase - totals.expense;

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

      <View className="mb-3 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-emerald-50 p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <Ionicons name="arrow-down" size={15} color="#059669" />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#6EE7B7" />
          </View>
          <Text className="text-xs font-semibold text-emerald-700">To Receive</Text>
          <Text className="mt-1 text-xl font-extrabold text-emerald-700">NPR {toReceive.toLocaleString()}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-red-50 p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <Ionicons name="arrow-up" size={15} color="#DC2626" />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
          </View>
          <Text className="text-xs font-semibold text-red-600">To Give</Text>
          <Text className="mt-1 text-xl font-extrabold text-red-600">NPR {toGive.toLocaleString()}</Text>
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-3">
        <Pressable
          onPress={() => router.push(`${basePath}/transactions?type=sale` as any)}
          className="flex-row items-center justify-between rounded-2xl bg-white p-3.5"
          style={{ width: '48%' }}
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
          style={{ width: '48%' }}
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
          style={{ width: '48%' }}
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
          style={{ width: '48%' }}
        >
          <View>
            <Text className="text-xs font-semibold text-gray-500">Net Balance</Text>
            <Text
              className="mt-1 text-base font-extrabold"
              style={{ color: netBalance >= 0 ? BLUE : '#DC2626' }}
            >
              NPR {netBalance.toLocaleString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
        </Pressable>
      </View>

      <View className="mb-3 flex-row gap-3">
        <Pressable
          onPress={() => router.push(`${basePath}/received` as any)}
          className="flex-1 flex-row items-center justify-between rounded-2xl bg-emerald-50 p-3.5"
        >
          <View>
            <Text className="text-xs font-semibold text-emerald-700">Total Received</Text>
            <Text className="mt-1 text-base font-extrabold text-emerald-700">NPR {yearReceived.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#6EE7B7" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`${basePath}/paid` as any)}
          className="flex-1 flex-row items-center justify-between rounded-2xl bg-red-50 p-3.5"
        >
          <View>
            <Text className="text-xs font-semibold text-red-600">Total Paid</Text>
            <Text className="mt-1 text-base font-extrabold text-red-600">NPR {yearPaid.toLocaleString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#FCA5A5" />
        </Pressable>
      </View>

      {isReseller && <ShopOverviewSection basePath={basePath} />}

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

      <Text className="mb-2 text-sm font-semibold text-gray-900">Shortcuts</Text>
      <View className="mb-4 flex-row flex-wrap gap-3">
        {shortcuts(basePath).map((s) => (
          <Pressable
            key={s.key}
            onPress={() => router.push(s.href as any)}
            className="items-center rounded-2xl border border-gray-200 bg-white py-4"
            style={{ width: '31%' }}
          >
            <View className="mb-1.5 h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name={s.icon} size={22} color={BLUE} />
            </View>
            <Text className="text-center text-xs font-semibold text-gray-700">{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-3 text-sm font-semibold text-gray-900">Cashflow (Last 7 Days)</Text>
        <CashflowChart data={cashflow} />
      </View>

      <Text className="text-center text-xs text-gray-400">
        Across {customers?.length ?? 0} customer{(customers?.length ?? 0) === 1 ? '' : 's'}
      </Text>
    </ScrollView>
  );
}
