// lib/components/finance/FinanceDashboardScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const userId = useAuthStore((state) => state.session?.user.id);
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

  const monthTotals = useMemo(() => {
    const now = new Date();
    const totals = { sale: 0, purchase: 0, expense: 0 };
    for (const t of transactions ?? []) {
      const created = new Date(t.created_at);
      if (created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()) {
        totals[t.type] += t.amount;
      }
    }
    return totals;
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

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-emerald-50 p-4">
          <Text className="text-xs font-semibold text-emerald-700">To Receive ↓</Text>
          <Text className="mt-1 text-xl font-extrabold text-emerald-700">NPR {toReceive.toLocaleString()}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-red-50 p-4">
          <Text className="text-xs font-semibold text-red-600">To Give ↑</Text>
          <Text className="mt-1 text-xl font-extrabold text-red-600">NPR {toGive.toLocaleString()}</Text>
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-white p-3.5">
          <Text className="text-xs font-semibold text-gray-500">Sales (this month)</Text>
          <Text className="mt-1 text-base font-extrabold text-emerald-600">NPR {monthTotals.sale.toLocaleString()}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-white p-3.5">
          <Text className="text-xs font-semibold text-gray-500">Purchase (this month)</Text>
          <Text className="mt-1 text-base font-extrabold text-blue-600">NPR {monthTotals.purchase.toLocaleString()}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-white p-3.5">
          <Text className="text-xs font-semibold text-gray-500">Expense (this month)</Text>
          <Text className="mt-1 text-base font-extrabold text-red-600">NPR {monthTotals.expense.toLocaleString()}</Text>
        </View>
      </View>

      <Text className="mb-2 text-sm font-semibold text-gray-900">Shortcuts</Text>
      <View className="mb-4 flex-row flex-wrap gap-3">
        {shortcuts(basePath).map((s) => (
          <Pressable
            key={s.key}
            onPress={() => router.push(s.href as any)}
            className="items-center rounded-2xl border border-gray-200 bg-white py-4"
            style={{ width: '31%' }}
          >
            <View className="mb-1.5 h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name={s.icon} size={20} color="#2563eb" />
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
