// app/(technician)/statement.tsx
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { jobCardAmount, type JobCardWithQuote } from './earnings';

type RangeKey = '7d' | '30d' | 'month' | 'all';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

function rangeStart(key: RangeKey, now: Date): Date | null {
  switch (key) {
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all':
      return null;
  }
}

export default function TechnicianStatement() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [range, setRange] = useState<RangeKey>('30d');

  const { data: jobCards, isLoading } = useSupabaseQuery('job_cards', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    columns: '*, service_requests(quoted_price, issue_type)',
    enabled: !!userId,
  }) as { data: JobCardWithQuote[] | undefined; isLoading: boolean };

  const { rows, periodTotal, lifetimeTotal } = useMemo(() => {
    const completed = (jobCards ?? []).filter((c): c is JobCardWithQuote & { completed_at: string } => !!c.completed_at);

    // Oldest first so the running balance accumulates forward in time,
    // matching how a bank statement reads.
    const chronological = [...completed].sort(
      (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    let balance = 0;
    const withBalance = chronological.map((c) => {
      balance += jobCardAmount(c);
      return {
        id: c.id,
        date: new Date(c.completed_at),
        title: c.service_requests?.issue_type ?? 'Job',
        amount: jobCardAmount(c),
        balance,
      };
    });

    const start = rangeStart(range, new Date());
    const filtered = start ? withBalance.filter((r) => r.date >= start) : withBalance;
    const periodTotal = filtered.reduce((sum, r) => sum + r.amount, 0);
    // The running balance is lifetime, independent of which period is
    // filtered into view - it's whatever the last chronological entry adds
    // up to, not the total of the (possibly narrower) visible rows.
    const lifetimeTotal = withBalance[withBalance.length - 1]?.balance ?? 0;

    return { rows: [...filtered].reverse(), periodTotal, lifetimeTotal };
  }, [jobCards, range]);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-5 rounded-2xl bg-[#0D9488] p-5">
        <Text className="text-[12.5px] font-semibold text-white/85">Lifetime earnings</Text>
        <Text className="mt-1 text-[28px] font-extrabold text-white">NPR {lifetimeTotal.toLocaleString()}</Text>
      </View>

      <View className="mb-4 flex-row" style={{ gap: 8 }}>
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              className="flex-1 items-center rounded-full py-2"
              style={{ backgroundColor: active ? '#2563EB' : '#FFFFFF', borderWidth: active ? 0 : 1, borderColor: '#E5E7EB' }}
            >
              <Text className={`text-[12.5px] font-bold ${active ? 'text-white' : 'text-gray-700'}`}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mb-5 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
        <Text className="text-sm text-gray-600">Earned in this period</Text>
        <Text className="text-[15px] font-extrabold text-gray-900">NPR {periodTotal.toLocaleString()}</Text>
      </View>

      <Text className="mb-3 text-[15px] font-bold text-gray-900">Transactions</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && rows.length === 0 && <Text className="text-gray-500">No transactions in this period.</Text>}

      {rows.map((row) => (
        <View key={row.id} className="mb-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-2 text-sm font-semibold text-gray-900" numberOfLines={1}>
              {row.title}
            </Text>
            <Text className="text-[13.5px] font-extrabold text-[#0D9488]">+NPR {row.amount.toLocaleString()}</Text>
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-xs text-gray-400">
              {row.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text className="text-xs text-gray-400">Balance: NPR {row.balance.toLocaleString()}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
