// lib/components/finance/PartyBalancesScreen.tsx
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { ToolbarSearch, useBarActions, useBookLayout } from './BookKit';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { useYearCashTotals } from '../../hooks/useYearCashTotals';
import { nameCaps } from '../../utils/nameCaps';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import { localTodayIso } from '../../utils/localDate';
import { reportHtml, type PrintReport } from '../../utils/printReport';
import { ExcelButton, PrintButton, exportReportDocument, printReportDocument } from './PrintButton';

type Direction = 'receive' | 'give';

interface Row {
  partyId: string;
  name: string;
  balance: number;
}

// Matches the dashboard's To Receive/To Give tiles exactly (emerald-700 /
// red-600 text on emerald-50 / red-50, emerald-200 / red-200 borders) so
// opening either one feels like the same card, just expanded.
const META: Record<
  Direction,
  {
    subtitle: string;
    color: string;
    bg: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
    empty: string;
    /** The second card: money that actually moved this year, opening its full report. */
    cashLabel: string;
    cashIcon: keyof typeof Ionicons.glyphMap;
    cashPath: string;
  }
> = {
  receive: {
    subtitle: 'Receivable',
    color: '#047857',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: 'people-outline',
    empty: 'No customer owes you anything right now.',
    cashLabel: 'Total received',
    cashIcon: 'arrow-down-circle-outline',
    cashPath: '/received',
  },
  give: {
    subtitle: 'Payable',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: 'cart-outline',
    empty: "You don't owe any vendor right now.",
    cashLabel: 'Total paid',
    cashIcon: 'arrow-up-circle-outline',
    cashPath: '/paid',
  },
};

/** Detail view behind the dashboard's To Receive / To Give tiles - who
 * specifically makes up that total, so it isn't just one opaque number.
 * Reads customer_ledger_entries for "receive" (customers who owe the
 * business) or vendor_ledger_entries for "give" (vendors the business
 * owes) - opposite tables with opposite polarity, see 0059_vendor_ledger.sql. */
export function PartyBalancesScreen({ basePath, direction }: { basePath: string; direction: Direction }) {
  const meta = META[direction];
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  // `all`: balances are sums over every entry; a plain read stops at 1000 rows.
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId && direction === 'receive',
  });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId && direction === 'give',
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const rows = useMemo((): Row[] => {
    const perParty: Record<string, number> = {};
    if (direction === 'receive') {
      for (const e of customerEntries ?? []) {
        perParty[e.customer_id] = (perParty[e.customer_id] ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount);
      }
    } else {
      for (const e of vendorEntries ?? []) {
        perParty[e.vendor_id] = (perParty[e.vendor_id] ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount);
      }
    }
    return Object.entries(perParty)
      .filter(([, balance]) => balance > 0)
      .map(([partyId, balance]) => ({ partyId, name: nameById.get(partyId) ?? 'Unknown', balance }))
      .sort((a, b) => b.balance - a.balance);
  }, [direction, customerEntries, vendorEntries, nameById]);

  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  // The name typed in the search bar narrows the list (and what prints); the card above keeps the
  // whole total.
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const shownRows = useMemo(
    () => (needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows),
    [rows, needle]
  );
  const shownTotal = shownRows.reduce((sum, r) => sum + r.balance, 0);
  const cash = useYearCashTotals(userId);
  const cashTotal = direction === 'receive' ? cash.received : cash.paid;

  // The name (and the back button on a phone) are in the top bar, with Print: it opens the system's
  // print preview of the page. The bar keeps the button it was given, so it reaches the current
  // page through a ref.
  const layout = useBookLayout();
  const profile = useAuthStore((state) => state.profile);
  const buildReport = (): PrintReport => ({
    title: `${meta.subtitle} Report`,
    businessName: profile?.business_name ?? profile?.full_name ?? '',
    subtitle: direction === 'receive' ? 'Customers who owe you money' : 'Vendors you owe money to',
    printedOn: toBsHistoryLabel(localTodayIso()),
    summary: [
      { label: meta.subtitle, value: `NPR ${shownTotal.toLocaleString()}` },
      { label: `${meta.cashLabel} (this year)`, value: `NPR ${cashTotal.toLocaleString()}` },
      { label: direction === 'receive' ? 'Customers' : 'Vendors', value: String(shownRows.length) },
    ],
    sections: [
      {
        columns: [{ label: 'SN' }, { label: 'Party' }, { label: 'Balance (NPR)', align: 'right' }],
        rows: shownRows.map((r, i) => [String(i + 1), nameCaps(r.name), r.balance.toLocaleString()]),
        footer: ['', 'Total', shownTotal.toLocaleString()],
        emptyText: meta.empty,
      },
    ],
  });
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
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1 justify-between rounded-2xl border p-4" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
          <View className="mb-1 flex-row items-center gap-2">
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <Text className="flex-1 text-xs font-semibold" style={{ color: meta.color }}>
              {meta.subtitle}
            </Text>
          </View>
          <Text className="text-xl font-extrabold" style={{ color: meta.color }} numberOfLines={1}>
            NPR {total.toLocaleString()}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push(`${basePath}${meta.cashPath}` as any)}
          accessibilityRole="button"
          accessibilityLabel={meta.cashLabel}
          className="flex-1 justify-between rounded-2xl border p-4"
          style={{ backgroundColor: meta.bg, borderColor: meta.border }}
        >
          <View className="mb-1 flex-row items-center gap-2">
            <Ionicons name={meta.cashIcon} size={16} color={meta.color} />
            <Text className="flex-1 text-xs font-semibold" style={{ color: meta.color }}>
              {meta.cashLabel} · This year
            </Text>
          </View>
          <Text className="text-xl font-extrabold" style={{ color: meta.color }} numberOfLines={1}>
            NPR {cashTotal.toLocaleString()}
          </Text>
        </Pressable>
      </View>

      <View className="mb-3 flex-row">
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search by name" wide={false} />
      </View>

      <FlatList
        data={shownRows}
        keyExtractor={(r) => r.partyId}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`${basePath}/customer/${item.partyId}` as any)}
            className="mb-2.5 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white p-4"
          >
            <Text className="flex-1 pr-2 text-sm font-semibold text-gray-900" numberOfLines={1}>
              {nameCaps(item.name)}
            </Text>
            <Text className="text-sm font-extrabold" style={{ color: meta.color }}>
              NPR {item.balance.toLocaleString()}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#D1D5DB" style={{ marginLeft: 6 }} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name={meta.icon} size={28} color="#D1D5DB" />
            <Text className="mt-2 text-gray-500">{needle ? `No name matches "${search.trim()}".` : meta.empty}</Text>
          </View>
        }
      />
    </View>
  );
}
