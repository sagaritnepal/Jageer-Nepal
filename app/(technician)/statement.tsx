// app/(technician)/statement.tsx
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
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

// Matches the screen's own bg-gray-50 - the zigzag "teeth" are drawn in
// this color so they read as notches torn out of the white receipt, not as
// gray diamonds sitting on top of it.
const PAGE_BG = '#F3F4F6';

const MONO = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}) as string;

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

function rangeLabel(key: RangeKey, now: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const start = rangeStart(key, now);
  return start ? `${fmt(start)} – ${fmt(now)}` : 'All time';
}

function money(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A row of small squares, rotated 45deg and colored like the page behind
// the receipt, clipped to half height - the classic torn/perforated-edge
// look, without needing web-only CSS gradients (works on native too).
function ZigzagEdge({ flip }: { flip?: boolean }) {
  const TOOTH = 26;
  const teeth = 20;
  return (
    <View style={{ flexDirection: 'row', height: TOOTH / 2, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
      {Array.from({ length: teeth }).map((_, i) => (
        <View
          key={i}
          style={{
            width: TOOTH,
            height: TOOTH,
            backgroundColor: PAGE_BG,
            transform: [{ rotate: '45deg' }],
            marginLeft: i === 0 ? -TOOTH / 2 : -TOOTH * 0.15,
            marginTop: flip ? -TOOTH / 2 : 0,
          }}
        />
      ))}
    </View>
  );
}

function DashedRule() {
  return <View style={{ borderBottomWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB' }} />;
}

export default function TechnicianStatement() {
  const profile = useAuthStore((state) => state.profile);
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

  const now = new Date();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE_BG }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
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

      {/* The receipt itself */}
      <View style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
        <ZigzagEdge />
        <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 20 }}>
          <Text style={{ fontFamily: MONO, letterSpacing: 2 }} className="text-center text-[15px] font-extrabold text-gray-900">
            STATEMENT OF EARNINGS
          </Text>
          <Text style={{ fontFamily: MONO }} className="mt-1.5 text-center text-[12px] text-gray-600">
            {profile?.full_name ?? 'Technician'}
          </Text>
          <Text style={{ fontFamily: MONO }} className="text-center text-[11px] text-gray-400">
            {rangeLabel(range, now)}
          </Text>

          <View className="my-4">
            <DashedRule />
          </View>

          <View className="flex-row">
            <Text style={{ fontFamily: MONO, width: 52 }} className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Date
            </Text>
            <Text style={{ fontFamily: MONO }} className="flex-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Job
            </Text>
            <Text style={{ fontFamily: MONO }} className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Amount
            </Text>
          </View>

          <View className="mt-2">
            <DashedRule />
          </View>

          {isLoading && (
            <Text style={{ fontFamily: MONO }} className="py-6 text-center text-[12px] text-gray-400">
              loading...
            </Text>
          )}
          {!isLoading && rows.length === 0 && (
            <Text style={{ fontFamily: MONO }} className="py-6 text-center text-[12px] text-gray-400">
              -- no transactions --
            </Text>
          )}

          {rows.map((row) => (
            <View key={row.id} className="flex-row items-start py-2" style={{ gap: 4 }}>
              <Text style={{ fontFamily: MONO, width: 52 }} className="text-[11px] text-gray-500">
                {row.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
              </Text>
              <Text style={{ fontFamily: MONO }} className="flex-1 pr-2 text-[12px] text-gray-800" numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={{ fontFamily: MONO }} className="text-[12px] font-semibold text-gray-900">
                {money(row.amount)}
              </Text>
            </View>
          ))}

          <View className="mt-2">
            <DashedRule />
          </View>

          <View className="mt-2.5 flex-row items-center justify-between border-t-2 border-gray-900 pt-2.5">
            <Text style={{ fontFamily: MONO, letterSpacing: 1 }} className="text-[13px] font-extrabold text-gray-900">
              TOTAL
            </Text>
            <Text style={{ fontFamily: MONO }} className="text-[17px] font-extrabold text-gray-900">
              NPR {money(periodTotal)}
            </Text>
          </View>

          <Text style={{ fontFamily: MONO }} className="mt-4 text-center text-[10px] text-gray-400">
            {rows.length} item{rows.length === 1 ? '' : 's'} {'·'} lifetime balance NPR {money(lifetimeTotal)}
          </Text>
          <Text style={{ fontFamily: MONO }} className="mt-2 text-center text-[10px] text-gray-300">
            * * * * * * * * * * * * * *
          </Text>
        </View>
        <ZigzagEdge flip />
      </View>
    </ScrollView>
  );
}
