// lib/components/finance/InventoryScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useRole } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { useBankAccounts } from '../../hooks/useBankAccounts';
import { useCalendarMode } from '../../hooks/useCalendarMode';
import {
  BackButton,
  BookPage,
  BookStat,
  BookStats,
  BookTable,
  FilterTabs,
  Pill,
  ToolbarButton,
  ToolbarSearch,
  money,
  useBookLayout,
  useBookToolbar,
  type BookColumn,
} from './BookKit';
import { PopupCard } from './FormKit';
import { ExcelButton, PrintButton, exportReportDocument, printReportDocument } from './PrintButton';
import { useReportActions } from './PrintButton';
import { TransactionDetailModal } from './TransactionsScreen';
import { toBsHistoryLabel } from '../../utils/nepaliDate';
import { localTodayIso } from '../../utils/localDate';
import { compareItems, entryDay } from '../../utils/ledgerStatement';
import { reportHtml, type PrintReport } from '../../utils/printReport';
import type { BusinessTransaction } from '../../../types/database.types';

type StockStatus = 'ok' | 'out' | 'untracked';
type StatusFilter = 'all' | 'out';

const STATUS = {
  ok: { label: 'In stock', color: '#047857', bg: '#ECFDF5' },
  out: { label: 'Out', color: '#B91C1C', bg: '#FEF2F2' },
  untracked: { label: 'Bills only', color: '#4B5563', bg: '#F3F4F6' },
} satisfies Record<StockStatus, { label: string; color: string; bg: string }>;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Out' },
];

const IN_TONE = { label: 'Stock in', color: '#047857', bg: '#ECFDF5' };
const OUT_TONE = { label: 'Stock out', color: '#B91C1C', bg: '#FEF2F2' };

interface InventoryRow {
  key: string;
  name: string;
  category: string | null;
  price: number | null;
  cost: number | null;
  stockLevel: number | null; // null = not a real catalog product, so no tracked stock level
  sold: number;
  purchased: number;
  status: StockStatus;
  /** Stock on hand at cost price; null when there's no stock level or no cost. */
  value: number | null;
}

/** One line of an item on a bill: units that came in (a Purchase) or went out (a Sale). */
interface Movement {
  key: string;
  tx: BusinessTransaction;
  dir: 'in' | 'out';
  /** 'YYYY-MM-DD' */
  day: string;
  createdAt: string;
  billNo: string;
  party: string;
  qty: number;
  rate: number;
  amount: number;
  hsCode: string;
}

/** Quantities and prices keep their decimals (2.5 kg, Rs 12.50); `money` would round. */
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const rs = (n: number | null) => (n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

/** The name an item is matched by across bills: trimmed, any case. */
const nameKey = (name: string) => name.trim().toLowerCase();

/** One item's stock history in a popup: how many units are in stock now and what is known of them
 * (cost, price, last bought, last sold), then every bill line that brought units in (a Purchase,
 * which includes what was bought from a wholesaler) or took them out (a Sale), with the running
 * net after each. Tapping a line opens its bill. Print and Excel for it are in the blue bar. */
function StockItemPopup({
  row,
  moves,
  businessName,
  onOpenBill,
  onClose,
}: {
  row: InventoryRow;
  /** Oldest first. */
  moves: Movement[];
  businessName: string;
  onOpenBill: (tx: BusinessTransaction) => void;
  onClose: () => void;
}) {
  useCalendarMode(); // draws its dates again when the AD / BS toggle changes
  const { width } = useWindowDimensions();
  const roomy = width >= 860;

  // Newest first to read; the running net is worked out oldest first.
  const lines = useMemo(() => {
    let net = 0;
    return moves
      .map((m) => {
        net += m.dir === 'in' ? m.qty : -m.qty;
        return { ...m, net };
      })
      .reverse();
  }, [moves]);
  type Line = (typeof lines)[number];

  const totalIn = moves.filter((m) => m.dir === 'in').reduce((sum, m) => sum + m.qty, 0);
  const totalOut = moves.filter((m) => m.dir === 'out').reduce((sum, m) => sum + m.qty, 0);
  const net = totalIn - totalOut;
  const lastIn = [...moves].reverse().find((m) => m.dir === 'in');
  const lastOut = [...moves].reverse().find((m) => m.dir === 'out');
  const hsCode = [...moves].reverse().find((m) => m.hsCode)?.hsCode ?? '';
  const valueIn = moves.filter((m) => m.dir === 'in').reduce((sum, m) => sum + m.amount, 0);
  const valueOut = moves.filter((m) => m.dir === 'out').reduce((sum, m) => sum + m.amount, 0);

  const whenOf = (m: Movement | undefined) =>
    m ? [toBsHistoryLabel(m.day), m.party || null, `@ ${rs(m.rate)}`].filter(Boolean).join(' · ') : '—';
  const details: [string, string][] = [
    ['Category', row.category || '—'],
    ['Status', STATUS[row.status].label],
    ['HS code', hsCode || '—'],
    ['Cost price', rs(row.cost)],
    ['Selling price', rs(row.price)],
    ['Stock value (cost)', row.value != null ? `NPR ${money(row.value)}` : '—'],
    ['Last bought', whenOf(lastIn)],
    ['Last sold', whenOf(lastOut)],
  ];

  const typeLabel = (m: Movement) => (m.dir === 'in' ? IN_TONE : OUT_TONE);
  const buildReport = (): PrintReport => ({
    title: `${row.name} - stock in and out`,
    businessName,
    subtitle: [row.category, hsCode ? `HS ${hsCode}` : null].filter(Boolean).join(' · ') || undefined,
    printedOn: toBsHistoryLabel(localTodayIso()),
    summary: [
      { label: 'In stock now', value: row.stockLevel != null ? qty(row.stockLevel) : 'Bills only' },
      { label: 'Stock in', value: qty(totalIn) },
      { label: 'Stock out', value: qty(totalOut) },
      { label: 'Net on bills', value: qty(net) },
    ],
    sections: [
      {
        columns: [
          { label: 'SN' },
          { label: 'Date' },
          { label: 'Type' },
          { label: 'Bill no.' },
          { label: 'Party' },
          { label: 'In', align: 'right' },
          { label: 'Out', align: 'right' },
          { label: 'Rate', align: 'right' },
          { label: 'Amount (NPR)', align: 'right' },
          { label: 'Net so far', align: 'right' },
        ],
        rows: lines.map((l, i) => [
          String(i + 1),
          toBsHistoryLabel(l.day),
          typeLabel(l).label,
          l.billNo || '',
          l.party || '',
          l.dir === 'in' ? qty(l.qty) : '',
          l.dir === 'out' ? qty(l.qty) : '',
          rs(l.rate),
          money(l.amount),
          qty(l.net),
        ]),
        footer: ['', '', '', '', 'Total', qty(totalIn), qty(totalOut), '', '', qty(net)],
        emptyText: 'No bill has this item yet.',
      },
    ],
    note: 'Stock in is a Purchase bill (wholesale orders included); stock out is a Sale bill. "Net so far" adds them up bill by bill.',
  });

  const sn = (_l: Line, i: number) => <Text className="text-[12.5px] text-gray-500">{i + 1}</Text>;
  const qtyCell = (l: Line, dir: 'in' | 'out') =>
    l.dir === dir ? (
      <Text className="text-[12.5px] font-bold" style={{ color: dir === 'in' ? IN_TONE.color : OUT_TONE.color }}>
        {qty(l.qty)}
      </Text>
    ) : (
      <Text className="text-[12.5px] text-gray-300">—</Text>
    );
  const netCell = (l: Line) => (
    <Text className="text-[12.5px] font-bold text-gray-700" numberOfLines={1}>
      {qty(l.net)}
    </Text>
  );
  const columns: BookColumn<Line>[] = roomy
    ? [
        { key: 'sn', label: 'SN', width: 52, render: sn },
        { key: 'date', label: 'Date', width: 128, render: (l) => <Text className="text-[12.5px] text-gray-600">{toBsHistoryLabel(l.day)}</Text> },
        { key: 'type', label: 'Type', width: 100, render: (l) => <Pill text={typeLabel(l).label} color={typeLabel(l).color} bg={typeLabel(l).bg} /> },
        {
          key: 'bill',
          label: 'Bill no.',
          width: 140,
          render: (l) =>
            l.billNo ? (
              <Text className="text-[12.5px] font-semibold text-gray-700" numberOfLines={1}>
                {l.billNo}
              </Text>
            ) : (
              <Text className="text-[12.5px] text-gray-300">—</Text>
            ),
        },
        {
          key: 'party',
          label: 'Party',
          render: (l) => (
            <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
              {l.party || '—'}
            </Text>
          ),
        },
        { key: 'in', label: 'In', width: 76, align: 'right', render: (l) => qtyCell(l, 'in') },
        { key: 'out', label: 'Out', width: 76, align: 'right', render: (l) => qtyCell(l, 'out') },
        { key: 'rate', label: 'Rate', width: 90, align: 'right', render: (l) => <Text className="text-[12.5px] text-gray-700">{rs(l.rate)}</Text> },
        { key: 'amount', label: 'Amount', width: 110, align: 'right', render: (l) => <Text className="text-[12.5px] font-medium text-gray-900">{money(l.amount)}</Text> },
        { key: 'net', label: 'Net so far', width: 100, align: 'right', render: netCell },
      ]
    : [
        { key: 'sn', label: 'SN', width: 38, render: sn },
        {
          key: 'details',
          label: 'Details',
          render: (l) => (
            <View style={{ minWidth: 0, gap: 2 }}>
              <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
                {l.party || typeLabel(l).label}
              </Text>
              <Pill text={typeLabel(l).label} color={typeLabel(l).color} bg={typeLabel(l).bg} />
              <Text className="text-[11px] text-gray-400" numberOfLines={1}>
                {[toBsHistoryLabel(l.day), l.billNo || null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ),
        },
        {
          key: 'qty',
          label: 'Qty',
          width: 84,
          align: 'right',
          render: (l) => (
            <View className="items-end">
              <Text className="text-[12.5px] font-bold" style={{ color: typeLabel(l).color }}>
                {l.dir === 'in' ? '+' : '−'}
                {qty(l.qty)}
              </Text>
              <Text className="text-[11px] text-gray-400">Net {qty(l.net)}</Text>
            </View>
          ),
        },
      ];
  const footerCells = roomy
    ? {
        in: <Text className="text-[13px] font-extrabold" style={{ color: IN_TONE.color }}>{qty(totalIn)}</Text>,
        out: <Text className="text-[13px] font-extrabold" style={{ color: OUT_TONE.color }}>{qty(totalOut)}</Text>,
        amount: <Text className="text-[13px] font-extrabold text-gray-900">{money(valueIn - valueOut)}</Text>,
        net: <Text className="text-[13px] font-extrabold text-gray-900">{qty(net)}</Text>,
      }
    : { qty: <Text className="text-[13px] font-extrabold text-gray-900">{qty(net)}</Text> };

  // The product's own stock level also moves outside bills (opening stock, job parts, corrections), so
  // it can differ from what the bills add up to - say so rather than leave the two figures unexplained.
  const outsideBills = row.stockLevel != null ? row.stockLevel - net : null;

  return (
    <PopupCard
      title={row.name}
      onClose={onClose}
      maxWidth={1040}
      closeOnOutside
      headerRight={
        <>
          <PrintButton onPress={() => void printReportDocument(reportHtml(buildReport()))} />
          <ExcelButton onPress={() => void exportReportDocument(buildReport())} />
        </>
      }
    >
      <BookStats>
        <BookStat label="In stock now" value={row.stockLevel != null ? qty(row.stockLevel) : 'Bills only'} color={row.status === 'out' ? '#B91C1C' : '#111827'} />
        <BookStat label="Stock in" value={qty(totalIn)} color={IN_TONE.color} />
        <BookStat label="Stock out" value={qty(totalOut)} color={OUT_TONE.color} />
        <BookStat label="Net on bills" value={qty(net)} color="#374151" />
      </BookStats>

      <View className="flex-row flex-wrap rounded-xl border border-gray-200 bg-white px-4 py-3" style={{ columnGap: 28, rowGap: 10 }}>
        {details.map(([label, value]) => (
          <View key={label} style={{ minWidth: 150, maxWidth: 320 }}>
            <Text className="text-[11px] font-semibold capitalize tracking-wide text-gray-400">{label}</Text>
            <Text className="mt-0.5 text-[13px] font-medium text-gray-900">{value}</Text>
          </View>
        ))}
      </View>

      {lines.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-8">
          <Text className="text-gray-500">No bill has this item yet.</Text>
        </View>
      ) : (
        <BookTable
          stickyHeader
          columns={columns}
          rows={lines}
          rowKey={(l) => l.key}
          onRowPress={(l) => onOpenBill(l.tx)}
          footer={{ label: `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · Total`, cells: footerCells }}
        />
      )}

      <Text className="text-[11.5px] leading-[17px] text-gray-400">
        Stock in is a Purchase bill - a wholesale order that arrived is one - and stock out is a Sale bill. Tap a line to open its bill.
        {outsideBills != null && Math.abs(outsideBills) > 0.0005
          ? ` The stock now (${qty(row.stockLevel ?? 0)}) differs from what the bills add up to by ${qty(Math.abs(outsideBills))}: stock also changes outside bills - opening stock, parts used on a job, a correction.`
          : ''}
      </Text>
    </PopupCard>
  );
}

/** Stock and Inventory: the stock list cross-referenced with Finance - each product's current stock
 * level next to how many units of it have actually moved through Sale and Purchase bills (matched by
 * item name, since a bill's line items are typed or picked names, not a foreign key back to
 * `products`). Also includes items that only ever exist as a typed name in a bill (finance_items,
 * 0063_finance_items.sql) - a reseller can't add just any name to the real product catalog (it's
 * admin-curated), so plenty of what's actually bought and sold only lives there, not in `products`.
 *
 * A reseller buys stock from here too (the Buy Stock button, on to the wholesale marketplace) - what
 * arrives comes back as a Purchase bill, so it is in the item's stock-in history. Tapping an item
 * opens that history. Read-only: products are managed by admins, not from here. */
export function InventoryScreen({ basePath }: { basePath: string }) {
  const layout = useBookLayout();
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useAuthStore((state) => state.profile);
  const role = useRole();
  const bankAccounts = useBankAccounts(userId);
  const { data: products } = useSupabaseQuery('products', {
    filters: userId && role ? { seller_id: userId, seller_role: role } : {},
    orderBy: { column: 'name' },
    enabled: !!userId && !!role,
  });
  const { data: financeItems } = useSupabaseQuery('finance_items', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  // `all`: every unit on every bill is counted, and a plain read stops at the API's first 1000 bills.
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  // The item whose stock history is open in a popup, and a bill opened from it.
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [viewingTx, setViewingTx] = useState<BusinessTransaction | null>(null);

  // Buying stock is one of this page's jobs: the wholesale marketplace (a reseller's page only).
  const buyStockHref = basePath === '/(reseller)' ? `${basePath}/wholesale` : null;

  // Print and Excel: the list as it is on screen (see buildReport, below).
  const reportButtons = useReportActions(() => buildReport());

  // Search, the All / Out filter, Print, Excel and Buy Stock live in the top bar on a wide screen (a
  // plain row above the tiles on a phone).
  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      inBarMinWidth: 1320,
      left: layout.wide ? undefined : () => <BackButton onPress={() => router.back()} />,
      right: (inBar) => (
        <>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search your products" wide={inBar} />
          <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
          {reportButtons}
          <ToolbarButton icon="add" label="Add stock" onPress={() => router.push(`${basePath}/transactions?type=purchase&add=1` as never)} />
          {buyStockHref && <ToolbarButton icon="storefront" label="Buy Stock" onPress={() => router.push(buyStockHref as never)} />}
        </>
      ),
    },
    [search, filter, buyStockHref]
  );

  // Every bill line of every item, by item name: a Purchase brings units in, a Sale takes them out.
  const movementsByName = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const t of transactions ?? []) {
      if (t.type !== 'sale' && t.type !== 'purchase') continue;
      (t.items ?? []).forEach((item, i) => {
        const key = nameKey(item.description ?? '');
        if (!key) return;
        const q = Number(item.qty) || 0;
        const r = Number(item.rate) || 0;
        const list = map.get(key) ?? [];
        list.push({
          key: `${t.id}:${i}`,
          tx: t,
          dir: t.type === 'purchase' ? 'in' : 'out',
          day: entryDay(t.bill_date, t.created_at),
          createdAt: t.created_at,
          billNo: t.bill_no?.trim() ?? '',
          party: t.party_name?.trim() ?? '',
          qty: q,
          rate: r,
          amount: Number(item.amount) || q * r,
          hsCode: item.hs_code ?? '',
        });
        map.set(key, list);
      });
    }
    for (const list of map.values()) list.sort(compareItems);
    return map;
  }, [transactions]);

  const rows = useMemo((): InventoryRow[] => {
    const soldByName = new Map<string, number>();
    const purchasedByName = new Map<string, number>();
    for (const [key, list] of movementsByName) {
      for (const m of list) {
        const target = m.dir === 'out' ? soldByName : purchasedByName;
        target.set(key, (target.get(key) ?? 0) + m.qty);
      }
    }

    const seenNames = new Set<string>();
    const productRows: InventoryRow[] = (products ?? []).map((product) => {
      const key = nameKey(product.name);
      seenNames.add(key);
      const stock = Number(product.stock_level);
      const cost = product.purchase_price != null ? Number(product.purchase_price) : null;
      return {
        key: `p-${product.id}`,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        cost,
        stockLevel: stock,
        sold: soldByName.get(key) ?? 0,
        purchased: purchasedByName.get(key) ?? 0,
        status: stock <= 0 ? 'out' : 'ok',
        value: cost != null && stock > 0 ? stock * cost : null,
      };
    });

    // A typed item that's never actually shown up in a bill (rate saved but
    // never used) isn't real inventory yet - only list ones with activity.
    const financeItemRows: InventoryRow[] = (financeItems ?? [])
      .filter((item) => !seenNames.has(nameKey(item.name)))
      .map((item): InventoryRow | null => {
        const key = nameKey(item.name);
        const sold = soldByName.get(key) ?? 0;
        const purchased = purchasedByName.get(key) ?? 0;
        if (sold === 0 && purchased === 0) return null;
        return {
          key: `f-${item.id}`,
          name: item.name,
          category: null,
          price: item.rate,
          cost: null,
          stockLevel: null,
          sold,
          purchased,
          status: 'untracked',
          value: null,
        };
      })
      .filter((r): r is InventoryRow => r !== null);

    return [...productRows, ...financeItemRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, financeItems, movementsByName]);

  const stats = useMemo(
    () => ({
      items: rows.length,
      value: rows.reduce((sum, r) => sum + (r.value ?? 0), 0),
      out: rows.filter((r) => r.status === 'out').length,
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'out' && r.status !== 'out') return false;
      return !q || r.name.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, filter]);

  const totals = useMemo(
    () => ({
      sold: filteredRows.reduce((sum, r) => sum + r.sold, 0),
      purchased: filteredRows.reduce((sum, r) => sum + r.purchased, 0),
      value: filteredRows.reduce((sum, r) => sum + (r.value ?? 0), 0),
    }),
    [filteredRows]
  );

  const num = (text: string, color = '#374151', bold = false) => (
    <Text className={`text-[12.5px] ${bold ? 'font-bold' : 'font-medium'}`} style={{ color }} numberOfLines={1}>
      {text}
    </Text>
  );
  const dash = <Text className="text-[12.5px] text-gray-400">—</Text>;

  const stockColor = (r: InventoryRow) => (r.status === 'out' ? '#B91C1C' : '#111827');

  const itemCell = (r: InventoryRow, compact: boolean) => (
    <View style={{ minWidth: 0, gap: 2 }}>
      <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
        {r.name}
      </Text>
      {compact && <Pill text={STATUS[r.status].label} color={STATUS[r.status].color} bg={STATUS[r.status].bg} />}
      {!!r.category && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          {r.category}
        </Text>
      )}
      {compact && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          Sold {qty(r.sold)} · Bought {qty(r.purchased)}
        </Text>
      )}
    </View>
  );

  const snColumn = (width: number): BookColumn<InventoryRow> => ({
    key: 'sn',
    label: 'SN',
    width,
    render: (_r, i) => <Text className="text-[12.5px] text-gray-500">{i + 1}</Text>,
  });
  const columns: BookColumn<InventoryRow>[] = layout.full
    ? [
        snColumn(52),
        { key: 'item', label: 'Item', render: (r) => itemCell(r, false) },
        { key: 'stock', label: 'In stock', width: 96, align: 'right', render: (r) => (r.stockLevel != null ? num(qty(r.stockLevel), stockColor(r), true) : dash) },
        { key: 'status', label: 'Status', width: 90, render: (r) => <Pill text={STATUS[r.status].label} color={STATUS[r.status].color} bg={STATUS[r.status].bg} /> },
        { key: 'cost', label: 'Cost price', width: 90, align: 'right', render: (r) => (r.cost != null ? num(rs(r.cost), '#4B5563') : dash) },
        { key: 'price', label: 'Selling price', width: 100, align: 'right', render: (r) => (r.price != null ? num(rs(r.price)) : dash) },
        { key: 'sold', label: 'Sold', width: 72, align: 'right', render: (r) => num(qty(r.sold), '#047857', true) },
        { key: 'purchased', label: 'Purchased', width: 92, align: 'right', render: (r) => num(qty(r.purchased), '#B91C1C', true) },
        { key: 'value', label: 'Stock value', width: 108, align: 'right', render: (r) => (r.value != null ? num(money(r.value)) : dash) },
        { key: 'act', label: '', width: 34, align: 'right', render: () => <Ionicons name="chevron-forward" size={14} color="#D1D5DB" /> },
      ]
    : [
        snColumn(38),
        { key: 'item', label: 'Item', render: (r) => itemCell(r, true) },
        { key: 'stock', label: 'In stock', width: 84, align: 'right', render: (r) => (r.stockLevel != null ? num(qty(r.stockLevel), stockColor(r), true) : dash) },
        { key: 'price', label: 'Price', width: 80, align: 'right', render: (r) => (r.price != null ? num(rs(r.price)) : dash) },
      ];

  const footer = layout.full
    ? {
        label: `${filteredRows.length} ${filteredRows.length === 1 ? 'item' : 'items'} · Totals`,
        cells: {
          sold: <Text className="text-[13px] font-extrabold" style={{ color: '#047857' }}>{qty(totals.sold)}</Text>,
          purchased: <Text className="text-[13px] font-extrabold" style={{ color: '#B91C1C' }}>{qty(totals.purchased)}</Text>,
          value: <Text className="text-[13px] font-extrabold text-gray-900">{money(totals.value)}</Text>,
        },
      }
    : undefined;

  const toggleOut = () => setFilter((f) => (f === 'out' ? 'all' : 'out'));

  // The stock list as a document: the items on screen with their stock, prices and what moved.
  function buildReport(): PrintReport {
    const cell = (v: number | null) => (v == null ? '' : rs(v));
    return {
      title: 'Stock and Inventory',
      businessName: profile?.business_name ?? profile?.full_name ?? '',
      subtitle: [filter === 'out' ? 'Out of stock' : null, search.trim() ? `Matching "${search.trim()}"` : null].filter(Boolean).join(' · ') || undefined,
      printedOn: toBsHistoryLabel(localTodayIso()),
      summary: [
        { label: 'Items', value: String(stats.items) },
        { label: 'Stock value (cost)', value: `NPR ${money(stats.value)}` },
        { label: 'Out of stock', value: String(stats.out) },
      ],
      sections: [
        {
          columns: [
            { label: 'SN' },
            { label: 'Item' },
            { label: 'Category' },
            { label: 'In stock', align: 'right' },
            { label: 'Status' },
            { label: 'Cost price', align: 'right' },
            { label: 'Selling price', align: 'right' },
            { label: 'Sold', align: 'right' },
            { label: 'Purchased', align: 'right' },
            { label: 'Stock value', align: 'right' },
          ],
          rows: filteredRows.map((r, n) => [
            String(n + 1),
            r.name,
            r.category ?? '',
            r.stockLevel != null ? qty(r.stockLevel) : '',
            STATUS[r.status].label,
            cell(r.cost),
            cell(r.price),
            qty(r.sold),
            qty(r.purchased),
            r.value != null ? money(r.value) : '',
          ]),
          footer: ['', `${filteredRows.length} ${filteredRows.length === 1 ? 'item' : 'items'} · Totals`, '', '', '', '', '', qty(totals.sold), qty(totals.purchased), money(totals.value)],
          emptyText: rows.length > 0 ? 'No matches.' : 'Nothing bought or sold yet.',
        },
      ],
      note: 'Sold and Purchased count the units on Sale and Purchase bills, matched to products by item name.',
    };
  }

  const viewingRow = viewingKey ? rows.find((r) => r.key === viewingKey) ?? null : null;

  return (
    <BookPage wide={layout.wide}>
      {toolbar}

      <BookStats>
        <BookStat label="Items" value={String(stats.items)} color="#374151" />
        <BookStat label="Stock value (cost)" value={`NPR ${money(stats.value)}`} color="#1D4ED8" />
        <BookStat label="Out of stock" value={String(stats.out)} color="#B91C1C" onPress={toggleOut} />
      </BookStats>

      {filteredRows.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-10">
          <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">{rows.length > 0 ? 'No matches.' : 'Nothing bought or sold yet.'}</Text>
        </View>
      ) : (
        <BookTable columns={columns} rows={filteredRows} rowKey={(r) => r.key} onRowPress={(r) => setViewingKey(r.key)} footer={footer} />
      )}

      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        Tap an item to see every unit that came in and went out. Sold and Purchased count the units on your Sale and Purchase bills, matched to products by
        item name. Items marked "Bills only" were typed into a bill and are not catalog products, so they have no tracked stock.
      </Text>

      {viewingRow && (
        <StockItemPopup
          key={viewingRow.key}
          row={viewingRow}
          moves={movementsByName.get(nameKey(viewingRow.name)) ?? []}
          businessName={profile?.business_name ?? profile?.full_name ?? ''}
          onOpenBill={setViewingTx}
          onClose={() => setViewingKey(null)}
        />
      )}
      <TransactionDetailModal
        tx={viewingTx}
        categoryName={null}
        bankAccountName={
          viewingTx?.bank_account_id ? bankAccounts.accounts.find((a) => a.id === viewingTx.bank_account_id)?.name ?? null : null
        }
        onClose={() => setViewingTx(null)}
        onEdit={() => {
          if (viewingTx) router.push(`${basePath}/transactions?type=${viewingTx.type}&add=1&edit=${viewingTx.id}` as never);
          setViewingTx(null);
          setViewingKey(null);
        }}
        editOnPage
      />
    </BookPage>
  );
}
