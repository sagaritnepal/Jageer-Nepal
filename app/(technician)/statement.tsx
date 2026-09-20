// app/(technician)/statement.tsx
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { jobCardAmount, type JobCardWithQuote } from './earnings';
import type { JobCard } from '../../types/database.types';

type RangeKey = '7d' | '30d' | 'month' | 'all';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

// Matches the screen's own background - the zigzag "teeth" are drawn in
// this color so they read as notches torn out of the white receipt, not as
// gray diamonds sitting on top of it.
const PAGE_BG = '#F3F4F6';

const MONO = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}) as string;

type JobCardWithDetails = JobCard & {
  service_requests: {
    quoted_price: number | null;
    issue_type: string;
    description: string | null;
    reseller_id: string | null;
  } | null;
};

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between py-1" style={{ gap: 10 }}>
      <Text style={{ fontFamily: MONO }} className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </Text>
      <Text style={{ fontFamily: MONO }} className="flex-1 text-right text-[12px] text-gray-800" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

type JobRow = {
  id: string;
  date: Date;
  title: string;
  description: string | null;
  resellerId: string | null;
  amount: number;
};

// One job = one receipt, its own reseller lookup and all - a technician
// reading this should be able to hand a single card to someone as proof of
// exactly what that job paid, not have to point at a row in a shared table.
function JobReceiptCard({ row, technicianName }: { row: JobRow; technicianName: string }) {
  const { data: reseller } = useSupabaseRow('profiles', row.resellerId ?? undefined);
  const resellerName = row.resellerId ? (reseller?.full_name ?? '…') : '—';

  return (
    <View
      className="mb-5"
      style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}
    >
      <ZigzagEdge />
      <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 20 }}>
        <Text style={{ fontFamily: MONO, letterSpacing: 2 }} className="text-center text-[14px] font-extrabold text-gray-900">
          JOB STATEMENT
        </Text>
        <Text style={{ fontFamily: MONO }} className="mt-1.5 text-center text-[13px] font-bold text-gray-800" numberOfLines={2}>
          {row.title}
        </Text>

        <View className="my-3.5">
          <DashedRule />
        </View>

        <DetailRow label="Date" value={row.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} />
        <DetailRow label="Reseller" value={resellerName} />
        <DetailRow label="Technician" value={technicianName} />

        {row.description && (
          <>
            <View className="my-3">
              <DashedRule />
            </View>
            <Text style={{ fontFamily: MONO }} className="text-[11.5px] italic leading-4 text-gray-500">
              {row.description}
            </Text>
          </>
        )}

        <View className="my-3">
          <DashedRule />
        </View>

        <View className="flex-row items-center justify-between border-t-2 border-gray-900 pt-2.5">
          <Text style={{ fontFamily: MONO, letterSpacing: 1 }} className="text-[13px] font-extrabold text-gray-900">
            TOTAL
          </Text>
          <Text style={{ fontFamily: MONO }} className="text-[17px] font-extrabold text-gray-900">
            NPR {money(row.amount)}
          </Text>
        </View>

        <Text style={{ fontFamily: MONO }} className="mt-4 text-center text-[10px] text-gray-300">
          * * * * * * * * * * * * * *
        </Text>
      </View>
      <ZigzagEdge flip />
    </View>
  );
}

export default function TechnicianStatement() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [range, setRange] = useState<RangeKey>('30d');

  const { data: jobCards, isLoading } = useSupabaseQuery('job_cards', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    columns: '*, service_requests(quoted_price, issue_type, description, reseller_id)',
    enabled: !!userId,
  }) as { data: JobCardWithDetails[] | undefined; isLoading: boolean };

  const { rows, periodTotal } = useMemo(() => {
    const completed = (jobCards ?? []).filter((c): c is JobCardWithDetails & { completed_at: string } => !!c.completed_at);

    const withDetails: JobRow[] = completed
      .map((c) => ({
        id: c.id,
        date: new Date(c.completed_at),
        title: c.service_requests?.issue_type ?? 'Job',
        description: c.service_requests?.description ?? null,
        resellerId: c.service_requests?.reseller_id ?? null,
        amount: jobCardAmount(c),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const start = rangeStart(range, new Date());
    const filtered = start ? withDetails.filter((r) => r.date >= start) : withDetails;
    const periodTotal = filtered.reduce((sum, r) => sum + r.amount, 0);

    return { rows: filtered, periodTotal };
  }, [jobCards, range]);

  const technicianName = profile?.full_name ?? 'Technician';

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

      <Text className="mb-4 text-center text-[12.5px] text-gray-500">
        {rows.length} job{rows.length === 1 ? '' : 's'} · NPR {periodTotal.toLocaleString()} this period
      </Text>

      {isLoading && <Text className="text-center text-gray-400">Loading…</Text>}
      {!isLoading && rows.length === 0 && (
        <Text className="text-center text-gray-400">No completed jobs in this period.</Text>
      )}

      {rows.map((row) => (
        <JobReceiptCard key={row.id} row={row} technicianName={technicianName} />
      ))}
    </ScrollView>
  );
}
