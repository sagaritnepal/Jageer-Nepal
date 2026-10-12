// lib/components/finance/ReportScreen.tsx
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { useBarActions, useBookLayout } from './BookKit';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import { localTodayIso } from '../../utils/localDate';
import { reportHtml, type PrintReport } from '../../utils/printReport';
import { ExcelButton, PrintButton, exportReportDocument, printReportDocument } from './PrintButton';
import { DateStepFilter } from './DateRangeFilter';

type Period = 'month' | 'year' | 'all';

type ReportLink = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  path: string;
  children?: ReportLink[];
};

/** The five report types. Total Received / Total Paid are the cards on top of the Receivable / Payable Report. */
const REPORT_GROUPS: { heading: string; links: ReportLink[] }[] = [
  {
    heading: 'Reports',
    links: [
      { title: 'Sales Report', subtitle: 'Every sale bill, newest first', icon: 'trending-up', color: '#059669', path: '/sales-report' },
      { title: 'Purchase Report', subtitle: 'Every purchase bill, newest first', icon: 'cart', color: '#DC2626', path: '/purchase-report' },
      { title: 'Expenses Report', subtitle: 'Every expense you recorded, newest first', icon: 'receipt', color: '#DC2626', path: '/expense-report' },
      {
        title: 'Receivable Report',
        subtitle: 'Customers who owe you money',
        icon: 'people',
        color: '#059669',
        path: '/to-receive',
      },
      {
        title: 'Payable Report',
        subtitle: 'Vendors you owe money to',
        icon: 'storefront',
        color: '#DC2626',
        path: '/to-give',
      },
    ],
  },
];

const PERIOD_LABEL: Record<Period, string> = { month: 'This Month', year: 'This Year', all: 'All Time' };

function Row({ label, value, color = '#111827', bold = false }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{label}</Text>
      <Text className={`text-sm ${bold ? 'font-extrabold' : 'font-semibold'}`} style={{ color }}>
        NPR {value.toLocaleString()}
      </Text>
    </View>
  );
}

/** A profit & loss summary pulled from the same Finance data as everywhere
 * else - Sales, Purchase, and Expense already carry their own bill date, so
 * this just re-sums them for whichever period is selected instead of
 * introducing a second source of truth. */
export function ReportScreen({ basePath }: { basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  // The period: one of the ready-made ones, or the dates picked with the date control.
  const [period, setPeriod] = useState<Period | 'range'>('month');
  const [range, setRange] = useState({ from: '', to: '' });

  const inRange = useMemo(() => {
    const now = new Date();
    return (transactions ?? []).filter((t) => {
      if (period === 'all') return true;
      if (period === 'range') {
        // A bill's own date as it is; a timestamp as the device's own day.
        let day = t.bill_date ? t.bill_date.slice(0, 10) : '';
        if (!day) {
          const c = new Date(t.created_at);
          day = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
        }
        return (!range.from || day >= range.from) && (!range.to || day <= range.to);
      }
      const d = new Date(t.bill_date ?? t.created_at);
      if (period === 'year') return d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [transactions, period, range.from, range.to]);

  const totals = useMemo(() => {
    const result = { sale: 0, purchase: 0, expense: 0 };
    for (const t of inRange) result[t.type] += t.amount;
    return result;
  }, [inRange]);

  const grossProfit = totals.sale - totals.purchase;
  const netProfit = grossProfit - totals.expense;

  // The name (and the back button on a phone) are in the top bar, with Print: it opens the system's
  // print preview of the profit & loss for the period shown.
  const layout = useBookLayout();
  const profile = useAuthStore((state) => state.profile);
  const buildReport = (): PrintReport => {
    const n = (v: number) => v.toLocaleString();
    return {
      title: 'Profit & Loss',
      businessName: profile?.business_name ?? profile?.full_name ?? '',
      subtitle:
        period !== 'range'
          ? PERIOD_LABEL[period]
          : range.from && range.from === range.to
            ? toBsHistoryLabel(range.from)
            : `${range.from ? toBsHistoryLabel(range.from) : 'Start'} - ${range.to ? toBsHistoryLabel(range.to) : 'Today'}`,
      printedOn: toBsHistoryLabel(localTodayIso()),
      sections: [
        {
          columns: [{ label: 'Account' }, { label: 'Amount (NPR)', align: 'right' }],
          rows: [
            ['Sales', n(totals.sale)],
            ['Purchase', n(totals.purchase)],
            ['Gross Profit', n(grossProfit)],
            ['Expenses', n(totals.expense)],
            ['Net Profit', n(netProfit)],
          ],
        },
      ],
      note: 'Sales, Purchase and Expenses are the bills dated in the period, paid or not.',
    };
  };
  const printNow = useRef<() => void>(() => {});
  printNow.current = () => void printReportDocument(reportHtml(buildReport()));
  const excelNow = useRef<() => void>(() => {});
  excelNow.current = () => void exportReportDocument(buildReport());
  useBarActions({ wide: layout.wide, right: () => (
        <>
          <PrintButton onPress={() => printNow.current()} />
          <ExcelButton onPress={() => excelNow.current()} />
        </>
      ) }, []);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* The same date control as the Day Book: arrows, and a menu of This Month / This Year / All Time,
          Today, Yesterday, the last 7 / 14 / 30 days and a custom range. */}
      <View className="mb-4 flex-row items-center">
        <DateStepFilter
          from={period === 'range' ? range.from : ''}
          to={period === 'range' ? range.to : ''}
          idleLabel={PERIOD_LABEL[period === 'range' ? 'month' : period]}
          onChange={(f, t) => {
            if (f || t) {
              setRange({ from: f, to: t });
              setPeriod('range');
            } else {
              setPeriod('month');
            }
          }}
          shortcuts={(['month', 'year', 'all'] as Period[]).map((p) => ({
            label: PERIOD_LABEL[p],
            on: period === p,
            onSelect: () => setPeriod(p),
          }))}
        />
      </View>

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="mb-1 text-xs font-semibold capitalize tracking-wide text-gray-400">Profit &amp; Loss</Text>
        <Row label="Sales" value={totals.sale} color="#059669" />
        <View className="border-t border-gray-100" />
        <Row label="Purchase" value={totals.purchase} color="#DC2626" />
        <View className="border-t border-gray-100" />
        <Row label="Gross Profit" value={grossProfit} color={grossProfit >= 0 ? '#059669' : '#DC2626'} bold />
        <View className="mt-1 border-t border-gray-200" />
        <Row label="Expenses" value={totals.expense} color="#DC2626" />
        <View className="border-t border-gray-100" />
        <Row label="Net Profit" value={netProfit} color={netProfit >= 0 ? '#059669' : '#DC2626'} bold />
      </View>

      {REPORT_GROUPS.map((group, g) => (
        <View key={group.heading} className={`rounded-2xl border border-gray-200 bg-white p-4 ${g > 0 ? 'mt-4' : ''}`}>
          <Text className="mb-1 text-xs font-semibold capitalize tracking-wide text-gray-400">{group.heading}</Text>
          {group.links.map((r, i) => (
            <View key={r.title} className={i > 0 ? 'border-t border-gray-100' : ''}>
              <ReportMenuLink report={r} basePath={basePath} />
              {r.children?.map((child) => (
                <View key={child.title} className="ml-11 border-t border-gray-100">
                  <ReportMenuLink report={child} basePath={basePath} compact />
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ReportMenuLink({ report, basePath, compact = false }: { report: ReportLink; basePath: string; compact?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`${basePath}${report.path}` as any)}
      accessibilityRole="button"
      accessibilityLabel={report.title}
      className={`flex-row items-center ${compact ? 'py-2' : 'py-3'}`}
      style={{ gap: 12 }}
    >
      <View className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} items-center justify-center rounded-full`} style={{ backgroundColor: `${report.color}1A` }}>
        <Ionicons name={report.icon} size={compact ? 15 : 18} color={report.color} />
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-gray-900`}>{report.title}</Text>
        <Text className="text-xs text-gray-500" numberOfLines={1}>
          {report.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </Pressable>
  );
}
