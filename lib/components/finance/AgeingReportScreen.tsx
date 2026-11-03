// lib/components/finance/AgeingReportScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useCameFrom } from '../../hooks/useCameFrom';
import { useCalendarMode } from '../../hooks/useCalendarMode';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { usePartyDestination } from '../../hooks/usePartyDestination';
import { BackButton, BookPage, BookStat, BookStats, BookTable, FilterTabs, Pill, ToolbarSearch, money, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { useReportActions } from './PrintButton';
import { highlightText } from './Highlight';
import { nameCaps } from '../../utils/nameCaps';
import { shortDateLabel, toBsHistoryLabel } from '../../utils/nepaliDate';
import { localTodayIso } from '../../utils/localDate';
import type { PrintReport } from '../../utils/printReport';
import { AGEING_BUCKETS, computeOwed } from '../../utils/receivableAgeing';

type BucketFilter = 'all' | '0' | '1' | '2';

const FILTERS: { key: BucketFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '0', label: AGEING_BUCKETS[0].label },
  { key: '1', label: AGEING_BUCKETS[1].label },
  { key: '2', label: AGEING_BUCKETS[2].label },
];

interface AgeRow {
  id: string;
  name: string;
  balance: number;
  /** 'YYYY-MM-DD'; null when they were never billed. */
  lastBilledDay: string | null;
  days: number;
  bucket: 0 | 1 | 2;
}

/** Ageing Report: what is owed to you, party by party, and how long each has been waiting - up to 30 days, 31
 * to 60, more. A party is as old as the last time they were billed. The same figures as the Receivable ageing
 * card on the Company dashboard (see computeOwed). A line opens that party's ledger. */
export function AgeingReportScreen({ basePath }: { basePath: string }) {
  const layout = useBookLayout();
  const cameFrom = useCameFrom(basePath);
  useCalendarMode(); // draws its dates again when the AD / BS toggle changes
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useAuthStore((state) => state.profile);
  const { data: customers } = useSupabaseQuery('customers', { filters: userId ? { owner_id: userId } : {}, enabled: !!userId });
  // `all`: a balance is a sum over every entry; a plain read stops at 1000 rows.
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', { filters: userId ? { owner_id: userId } : {}, all: true, enabled: !!userId });
  const hrefFor = usePartyDestination(userId, basePath);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BucketFilter>('all');

  const owed = useMemo(() => computeOwed(customerEntries ?? [], vendorEntries ?? []), [customerEntries, vendorEntries]);
  const nameById = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c.name])), [customers]);

  // Oldest first, and the biggest first among the same age.
  const rows = useMemo(
    (): AgeRow[] =>
      owed.owing
        .map((o) => ({ id: o.id, name: nameById.get(o.id) ?? 'Unknown party', balance: o.balance, lastBilledDay: o.lastBilledDay, days: o.days, bucket: o.bucket }))
        .sort((a, b) => b.bucket - a.bucket || b.days - a.days || b.balance - a.balance),
    [owed.owing, nameById]
  );
  const countIn = (bucket: 0 | 1 | 2) => rows.filter((r) => r.bucket === bucket).length;

  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () => rows.filter((r) => (filter === 'all' || String(r.bucket) === filter) && (!needle || r.name.toLowerCase().includes(needle))),
    [rows, filter, needle]
  );
  const shownTotal = shown.reduce((sum, r) => sum + r.balance, 0);

  const daysText = (r: AgeRow) => (r.lastBilledDay ? `${Math.floor(r.days)} ${Math.floor(r.days) === 1 ? 'day' : 'days'}` : '—');

  function buildReport(): PrintReport {
    return {
      title: 'Ageing Report',
      businessName: profile?.business_name ?? profile?.full_name ?? '',
      subtitle: [filter !== 'all' ? AGEING_BUCKETS[Number(filter)].label : null, needle ? `Matching "${search.trim()}"` : null].filter(Boolean).join(' · ') || undefined,
      printedOn: toBsHistoryLabel(localTodayIso()),
      summary: [
        { label: 'Outstanding', value: `NPR ${money(owed.receivable)}` },
        ...AGEING_BUCKETS.map((b, i) => ({ label: b.label, value: `NPR ${money(owed.ageing[i])}` })),
      ],
      sections: [
        {
          columns: [
            { label: 'SN' },
            { label: 'Party' },
            { label: 'Last billed' },
            { label: 'Days', align: 'right' },
            { label: 'Age' },
            { label: 'Outstanding (NPR)', align: 'right' },
          ],
          rows: shown.map((r, n) => [String(n + 1), nameCaps(r.name), r.lastBilledDay ? toBsHistoryLabel(r.lastBilledDay) : '', r.lastBilledDay ? String(Math.floor(r.days)) : '', AGEING_BUCKETS[r.bucket].label, money(r.balance)]),
          footer: ['', `${shown.length} ${shown.length === 1 ? 'party' : 'parties'} · Total`, '', '', '', money(shownTotal)],
          emptyText: rows.length > 0 ? 'No matches.' : 'Nobody owes you anything.',
        },
      ],
      note: 'A party is as old as the last time they were billed; what they owe is counted in full from then.',
    };
  }
  const reportButtons = useReportActions(() => buildReport());

  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      // Opened from the Dashboard: a way back to it, on a wide screen too.
      left: layout.wide && !cameFrom ? undefined : () => <BackButton onPress={cameFrom?.back ?? (() => router.back())} label={cameFrom?.label} />,
      right: (inBar) => (
        <>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search by name" wide={inBar} />
          <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
          {reportButtons}
        </>
      ),
    },
    [search, filter, cameFrom?.label]
  );

  const agePill = (r: AgeRow) => <Pill text={AGEING_BUCKETS[r.bucket].label} color={AGEING_BUCKETS[r.bucket].color} bg={AGEING_BUCKETS[r.bucket].bg} />;
  const amount = (r: AgeRow) => (
    <Text className="text-[12.5px] font-bold" style={{ color: AGEING_BUCKETS[r.bucket].color }} numberOfLines={1}>
      {money(r.balance)}
    </Text>
  );
  const columns: BookColumn<AgeRow>[] = layout.full
    ? [
        { key: 'sn', label: 'SN', width: 52, render: (_r, i) => <Text className="text-[12.5px] text-gray-500">{i + 1}</Text> },
        {
          key: 'party',
          label: 'Party',
          render: (r) => (
            <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
              {highlightText(nameCaps(r.name), search)}
            </Text>
          ),
        },
        { key: 'last', label: 'Last billed', width: 150, render: (r) => <Text className="text-[12.5px] text-gray-500">{r.lastBilledDay ? toBsHistoryLabel(r.lastBilledDay) : '—'}</Text> },
        { key: 'days', label: 'Waiting', width: 100, align: 'right', render: (r) => <Text className="text-[12.5px] font-medium text-gray-700">{daysText(r)}</Text> },
        { key: 'age', label: 'Age', width: 120, render: agePill },
        { key: 'amount', label: 'Outstanding', width: 140, align: 'right', render: amount },
        { key: 'act', label: '', width: 34, align: 'right', render: () => <Ionicons name="chevron-forward" size={14} color="#D1D5DB" /> },
      ]
    : [
        { key: 'sn', label: 'SN', width: 38, render: (_r, i) => <Text className="text-[12.5px] text-gray-500">{i + 1}</Text> },
        {
          key: 'party',
          label: 'Party',
          render: (r) => (
            <View style={{ minWidth: 0, gap: 2 }}>
              <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
                {highlightText(nameCaps(r.name), search)}
              </Text>
              {agePill(r)}
              <Text className="text-[11px] text-gray-400" numberOfLines={1}>
                {r.lastBilledDay ? `Last billed ${shortDateLabel(r.lastBilledDay)} · ${daysText(r)}` : 'Never billed'}
              </Text>
            </View>
          ),
        },
        { key: 'amount', label: 'Outstanding', width: 100, align: 'right', render: amount },
      ];

  return (
    <BookPage wide={layout.wide}>
      {toolbar}

      <BookStats>
        <BookStat label={`Outstanding · ${owed.debtors} ${owed.debtors === 1 ? 'party' : 'parties'}`} value={`NPR ${money(owed.receivable)}`} color="#1D4ED8" onPress={() => setFilter('all')} />
        {AGEING_BUCKETS.map((b, i) => (
          <BookStat
            key={b.label}
            label={`${b.label} · ${countIn(i as 0 | 1 | 2)}`}
            value={`NPR ${money(owed.ageing[i])}`}
            color={b.color}
            onPress={() => setFilter(String(i) as BucketFilter)}
          />
        ))}
      </BookStats>

      {shown.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-10">
          <Ionicons name="time-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">{needle ? `No name matches "${search.trim()}".` : rows.length > 0 ? 'Nobody in this age group.' : 'Nobody owes you anything.'}</Text>
        </View>
      ) : (
        <BookTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          onRowPress={(r) => router.push(hrefFor(r.id) as never)}
          footer={{
            label: `${shown.length} ${shown.length === 1 ? 'party' : 'parties'} · Total`,
            cells: { amount: <Text className="text-[13px] font-extrabold text-gray-900">{money(shownTotal)}</Text> },
          }}
        />
      )}

      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        A party is as old as the last time they were billed, and what they owe is counted in full from then - the same ageing as the Receivable ageing card on your Dashboard. Tap a party to open their ledger.
      </Text>
    </BookPage>
  );
}
