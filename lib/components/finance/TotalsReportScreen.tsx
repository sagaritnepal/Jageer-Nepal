// lib/components/finance/TotalsReportScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { BarChart } from '../BarChart';

const DAY_MS = 24 * 60 * 60 * 1000;

type Kind = 'received' | 'paid';
type Granularity = 'day' | 'week' | 'month';

interface Entry {
  id: string;
  date: string;
  amount: number;
  label: string;
  sub: string;
}

const KIND_META: Record<Kind, { title: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  received: { title: 'Total Received', color: '#059669', bg: '#ECFDF5', icon: 'arrow-down-circle' },
  paid: { title: 'Total Paid', color: '#DC2626', bg: '#FEF2F2', icon: 'arrow-up-circle' },
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date) {
  const day = startOfDay(d);
  const dow = day.getDay() === 0 ? 7 : day.getDay(); // Monday = 1 ... Sunday = 7
  return new Date(day.getTime() - (dow - 1) * DAY_MS);
}

export function TotalsReportScreen({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind];
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: ledgerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });

  const [granularity, setGranularity] = useState<Granularity>('month');
  const year = new Date().getFullYear();

  // "Received" = real cash in (sales + every payment actually collected from a
  // customer, whether logged manually or synced from a paid booking).
  // "Paid" = real cash out (purchases, expenses, and manual Payment Out
  // entries) - deliberately excludes booking-sourced debit entries, since
  // those represent a customer owing money for a job, not the business
  // paying anything out.
  const entries = useMemo((): Entry[] => {
    const list: Entry[] = [];
    for (const t of transactions ?? []) {
      if (kind === 'received' && t.type === 'sale') {
        list.push({ id: t.id, date: t.created_at, amount: t.amount, label: 'Sale', sub: t.party_name ?? t.note ?? '' });
      }
      if (kind === 'paid' && (t.type === 'purchase' || t.type === 'expense')) {
        list.push({
          id: t.id,
          date: t.created_at,
          amount: t.amount,
          label: t.type === 'purchase' ? 'Purchase' : 'Expense',
          sub: t.party_name ?? t.note ?? '',
        });
      }
    }
    for (const e of ledgerEntries ?? []) {
      if (kind === 'received' && e.entry_type === 'credit') {
        list.push({
          id: e.id,
          date: e.created_at,
          amount: e.amount,
          label: e.source === 'booking' ? 'Job payment' : 'Payment received',
          sub: e.note ?? '',
        });
      }
      if (kind === 'paid' && e.entry_type === 'debit' && e.source === 'manual') {
        list.push({ id: e.id, date: e.created_at, amount: e.amount, label: 'Payment out', sub: e.note ?? '' });
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, ledgerEntries, kind]);

  const yearTotal = useMemo(
    () => entries.filter((e) => new Date(e.date).getFullYear() === year).reduce((sum, e) => sum + e.amount, 0),
    [entries, year]
  );

  const chartData = useMemo(() => {
    const now = new Date();
    if (granularity === 'day') {
      const days = Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - (29 - i) * DAY_MS));
      return days.map((d) => {
        const dayStart = startOfDay(d).getTime();
        const dayEnd = dayStart + DAY_MS;
        const value = entries
          .filter((e) => {
            const t = new Date(e.date).getTime();
            return t >= dayStart && t < dayEnd;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        return { label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), value };
      });
    }
    if (granularity === 'week') {
      const thisWeekStart = startOfWeek(now);
      const weeks = Array.from({ length: 12 }, (_, i) => new Date(thisWeekStart.getTime() - (11 - i) * 7 * DAY_MS));
      return weeks.map((weekStart) => {
        const start = weekStart.getTime();
        const end = start + 7 * DAY_MS;
        const value = entries
          .filter((e) => {
            const t = new Date(e.date).getTime();
            return t >= start && t < end;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        return { label: weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), value };
      });
    }
    // month: Jan-Dec of the current year
    return Array.from({ length: 12 }, (_, month) => {
      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 1).getTime();
      const value = entries
        .filter((e) => {
          const t = new Date(e.date).getTime();
          return t >= start && t < end;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      return { label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' }), value };
    });
  }, [entries, granularity, year]);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text className="text-base font-bold text-gray-900">{meta.title}</Text>
      </View>

      <View className="mb-4 rounded-2xl p-4" style={{ backgroundColor: meta.bg }}>
        <View className="mb-1 flex-row items-center gap-2">
          <Ionicons name={meta.icon} size={16} color={meta.color} />
          <Text className="text-xs font-semibold" style={{ color: meta.color }}>
            {year} total
          </Text>
        </View>
        <Text className="text-2xl font-extrabold" style={{ color: meta.color }}>
          NPR {yearTotal.toLocaleString()}
        </Text>
      </View>

      <View className="mb-3 flex-row gap-2">
        {(['day', 'week', 'month'] as Granularity[]).map((g) => {
          const selected = granularity === g;
          return (
            <Pressable
              key={g}
              onPress={() => setGranularity(g)}
              className={`flex-1 items-center rounded-full py-2 ${selected ? '' : 'border border-gray-200 bg-white'}`}
              style={selected ? { backgroundColor: meta.color } : undefined}
            >
              <Text className={`text-xs font-semibold capitalize ${selected ? 'text-white' : 'text-gray-600'}`}>
                {g}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-3 text-xs text-gray-400">
          {granularity === 'day' ? 'Last 30 days' : granularity === 'week' ? 'Last 12 weeks' : `${year}, by month`}
        </Text>
        <BarChart
          data={chartData}
          color={meta.color}
          selectedColor={meta.color}
          formatValue={(v) => `NPR ${Math.round(v).toLocaleString()}`}
          formatLabel={(label, i) =>
            granularity === 'day' ? (i % 5 === 0 ? label : null) : granularity === 'week' ? (i % 3 === 0 ? label : null) : label
          }
        />
      </View>

      <Text className="mb-2 text-sm font-semibold text-gray-900">{year} entries</Text>
      {entries.filter((e) => new Date(e.date).getFullYear() === year).length === 0 && (
        <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
          <Ionicons name="cash-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">Nothing here yet.</Text>
        </View>
      )}
      {entries
        .filter((e) => new Date(e.date).getFullYear() === year)
        .map((e) => (
          <View key={e.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-semibold text-gray-900">{e.label}</Text>
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {e.sub || new Date(e.date).toLocaleDateString()}
              </Text>
            </View>
            <Text className="text-sm font-extrabold" style={{ color: meta.color }}>
              NPR {e.amount.toLocaleString()}
            </Text>
          </View>
        ))}
    </ScrollView>
  );
}
