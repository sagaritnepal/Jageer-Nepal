// lib/components/finance/DayBookScreen.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { DateField } from '../DateTimeFields';
import { useWideDetail } from '../detail/DetailLayout';
import { toAdLabel, toBsLabel } from '../../utils/nepaliDate';

type BookRow = {
  id: string;
  time: string;
  details: string;
  sub: string | null;
  invoice: number | null;
  discount: number | null;
  amount: number;
  sortKey: string;
  href?: string;
  bold?: boolean;
};

/** Local calendar day of a timestamp, as YYYY-MM-DD - going through
 * toISOString would use UTC and shift late-evening Nepal entries a day. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + delta).toISOString());
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function money(n: number | null): string {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

// Column widths shared by every table so the inflow and outflow sides line
// up. Sized so all five columns fit in half a laptop-width content area
// (about 520px) without clipping the Amount column.
const COL = { time: 60, invoice: 80, discount: 72, amount: 94 };

function BookTable({
  title,
  accent,
  rows,
  total,
  totalLabel,
  empty,
  compact,
}: {
  title: string;
  accent: string;
  rows: BookRow[];
  total: number;
  totalLabel: string;
  empty: string;
  /** Phone width: Time | Details | Amount, with invoice and discount folded
   * under the details - five columns can't fit without sideways scrolling. */
  compact: boolean;
}) {
  const cell = 'px-2.5 py-2 border-r border-gray-200';
  const head = (label: string, style: object, right = false) => (
    <Text className={`${cell} text-[11.5px] font-bold text-gray-600 ${right ? 'text-right' : ''}`} style={style}>
      {label}
    </Text>
  );

  return (
    <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <View className="border-b border-gray-300 py-2" style={{ backgroundColor: accent }}>
        <Text className="text-center text-[13.5px] font-bold text-white">{title}</Text>
      </View>
      <View>
          <View className="flex-row border-b border-gray-300 bg-gray-50">
            {head('Time', { width: COL.time })}
            {head('Transaction details', { flex: 1 })}
            {!compact && head('Invoice', { width: COL.invoice }, true)}
            {!compact && head('Discount', { width: COL.discount }, true)}
            {head('Amount', { width: COL.amount }, true)}
          </View>

          {rows.length === 0 ? (
            <Text className="px-3 py-4 text-[13px] text-gray-400">{empty}</Text>
          ) : (
            rows.map((r) => (
              <Pressable
                key={r.id}
                onPress={r.href ? () => router.push(r.href as any) : undefined}
                disabled={!r.href}
                className="flex-row border-b border-gray-200"
              >
                <Text className={`${cell} text-[12.5px] text-gray-500`} style={{ width: COL.time }} numberOfLines={1}>
                  {r.time}
                </Text>
                <View className={cell} style={{ flex: 1 }}>
                  <Text className={`text-[13px] text-gray-900 ${r.bold ? 'font-bold' : 'font-medium'}`} numberOfLines={1}>
                    {r.details}
                  </Text>
                  {!!r.sub && (
                    <Text className="text-[11px] text-gray-400" numberOfLines={compact ? 2 : 1}>
                      {r.sub}
                    </Text>
                  )}
                  {compact && r.invoice != null && (
                    <Text className="text-[11px] text-gray-500">
                      Invoice {money(r.invoice)}
                      {r.discount ? ` · Discount ${money(r.discount)}` : ''}
                    </Text>
                  )}
                </View>
                {!compact && (
                  <Text className={`${cell} text-right text-[12.5px] text-gray-600`} style={{ width: COL.invoice }}>
                    {money(r.invoice)}
                  </Text>
                )}
                {!compact && (
                  <Text className={`${cell} text-right text-[12.5px] text-gray-600`} style={{ width: COL.discount }}>
                    {money(r.discount)}
                  </Text>
                )}
                <Text
                  className={`${cell} text-right text-[13px] text-gray-900 ${r.bold ? 'font-bold' : 'font-semibold'}`}
                  style={{ width: COL.amount }}
                >
                  {money(r.amount)}
                </Text>
              </Pressable>
            ))
          )}

          <View className="flex-row bg-gray-50">
            <Text className={`${cell} flex-1 text-right text-[12.5px] font-bold text-gray-700`}>{totalLabel}</Text>
            <Text className="px-2.5 py-2 text-right text-[13.5px] font-extrabold" style={{ width: COL.amount, color: accent }}>
              {money(total)}
            </Text>
          </View>
      </View>
    </View>
  );
}

/** The day's money laid out like a paper cash book: Cash Inflow beside Cash
 * Outflow, starting from the opening balance and ending at the closing one,
 * with the day's sales and purchase bills below in the same table format.
 * Uses the dashboard's definitions - a sale or purchase books a debt rather
 * than moving cash, the ledger rows it creates are skipped so nothing counts
 * twice, and entries sit on the date the user gave them. The opening balance
 * is every cash movement dated before this day, the same formula as the
 * Available Balance (useAccountBalances), so the two always agree. */
export function DayBookScreen({ basePath }: { basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const businessName = useAuthStore((state) => state.profile?.business_name);
  const wide = useWideDetail();
  const today = localDay(new Date().toISOString());
  const [day, setDay] = useState(today);

  const owner: Record<string, string> = userId ? { owner_id: userId } : {};
  const { data: transactions, isLoading } = useSupabaseQuery('business_transactions', { filters: owner, enabled: !!userId });
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: transfers } = useSupabaseQuery('account_transfers', { filters: owner, enabled: !!userId });
  const { data: contacts } = useSupabaseQuery('customers', { filters: owner, enabled: !!userId });
  const { data: accounts } = useSupabaseQuery('bank_accounts', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });
  const { data: categories } = useSupabaseQuery('expense_categories', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });

  const book = useMemo(() => {
    const contactName = new Map((contacts ?? []).map((c) => [c.id, c.name]));
    const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
    const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const via = (bankId: string | null) => (bankId ? (accountName.get(bankId) ?? 'Bank') : 'Cash');

    let opening = 0;
    const inflow: BookRow[] = [];
    const outflow: BookRow[] = [];
    const sales: BookRow[] = [];
    const purchases: BookRow[] = [];
    const moves: BookRow[] = [];

    for (const t of transactions ?? []) {
      const date = t.bill_date ?? localDay(t.created_at);
      if (t.type === 'expense' && date < day) opening -= t.amount;
      if (date !== day) continue;
      const discount = t.discount_amount ?? 0;
      const category = t.expense_category_id ? categoryName.get(t.expense_category_id) : null;
      const row: BookRow = {
        id: t.id,
        time: timeOf(t.created_at),
        details:
          t.type === 'expense'
            ? `Expense${t.party_name ? ` · ${t.party_name}` : category ? ` · ${category}` : ''}`
            : t.party_name || (t.type === 'sale' ? 'Sale' : 'Purchase'),
        sub:
          [
            t.bill_no ? `Bill #${t.bill_no}` : null,
            t.type === 'expense' && t.party_name ? category : null,
            t.note,
            t.type === 'expense' ? via(t.bank_account_id) : t.payment_mode === 'credit' ? 'On credit' : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        // Amount is after discount and VAT; the invoice value before them.
        invoice: t.amount + discount - (t.vat_amount ?? 0),
        discount,
        amount: t.amount,
        sortKey: t.created_at,
        href: `${basePath}/transactions?type=${t.type}`,
      };
      if (t.type === 'expense') outflow.push(row);
      else if (t.type === 'sale') sales.push(row);
      else purchases.push(row);
    }

    for (const e of customerEntries ?? []) {
      const isIn = e.entry_type === 'credit';
      // Booking debits are the Sale itself, not cash.
      if (!isIn && e.source !== 'manual') continue;
      const date = e.entry_date ?? localDay(e.created_at);
      if (date < day) opening += isIn ? e.amount : -e.amount;
      if (date !== day) continue;
      (isIn ? inflow : outflow).push({
        id: e.id,
        time: timeOf(e.created_at),
        details: `${isIn ? 'Received from' : 'Paid to'} ${contactName.get(e.customer_id) ?? 'customer'}`,
        sub: [e.receipt_no ? `Receipt #${e.receipt_no}` : null, via(e.bank_account_id), e.note].filter(Boolean).join(' · ') || null,
        invoice: null,
        discount: null,
        amount: e.amount,
        sortKey: e.created_at,
        href: `${basePath}/customer/${e.customer_id}`,
      });
    }

    for (const e of vendorEntries ?? []) {
      // Only payments to a vendor move money; debits are the Purchase.
      if (e.entry_type !== 'credit') continue;
      const date = e.entry_date ?? localDay(e.created_at);
      if (date < day) opening -= e.amount;
      if (date !== day) continue;
      outflow.push({
        id: e.id,
        time: timeOf(e.created_at),
        details: `Paid to ${contactName.get(e.vendor_id) ?? 'vendor'}`,
        sub: [e.receipt_no ? `Receipt #${e.receipt_no}` : null, via(e.bank_account_id), e.note].filter(Boolean).join(' · ') || null,
        invoice: null,
        discount: null,
        amount: e.amount,
        sortKey: e.created_at,
        href: `${basePath}/customer/${e.vendor_id}`,
      });
    }

    // A transfer only moves money between the owner's own accounts, so it
    // never changes the combined balance - listed for reference only.
    for (const tr of transfers ?? []) {
      if ((tr.transfer_date ?? localDay(tr.created_at)) !== day) continue;
      moves.push({
        id: tr.id,
        time: timeOf(tr.created_at),
        details: `${via(tr.from_account_id)} → ${via(tr.to_account_id)}`,
        sub: tr.note,
        invoice: null,
        discount: null,
        amount: tr.amount,
        sortKey: tr.created_at,
        href: `${basePath}/bank-accounts`,
      });
    }

    const byTime = (a: BookRow, b: BookRow) => a.sortKey.localeCompare(b.sortKey);
    [inflow, outflow, sales, purchases, moves].forEach((list) => list.sort(byTime));

    const sum = (list: BookRow[]) => list.reduce((s, r) => s + r.amount, 0);
    const totalIn = sum(inflow);
    const totalOut = sum(outflow);
    return {
      opening,
      inflow,
      outflow,
      sales,
      purchases,
      moves,
      totalIn,
      totalOut,
      totalSales: sum(sales),
      totalPurchases: sum(purchases),
      totalMoves: sum(moves),
      closing: opening + totalIn - totalOut,
    };
  }, [transactions, customerEntries, vendorEntries, transfers, contacts, accounts, categories, day, basePath]);

  const inflowRows: BookRow[] = [
    {
      id: 'opening',
      time: '',
      details: 'Opening balance',
      sub: 'Cash + bank at the start of the day',
      invoice: null,
      discount: null,
      amount: book.opening,
      sortKey: '',
      bold: true,
    },
    ...book.inflow,
  ];

  const header = (
    <View className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
      <View className={wide ? 'flex-row items-center' : ''} style={{ gap: 12 }}>
        <View className={wide ? 'flex-1' : 'items-center'}>
          {!!businessName && (
            <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{businessName}</Text>
          )}
          <Text className="text-center text-[17px] font-extrabold text-gray-900">Day Book · {toBsLabel(day)}</Text>
          <Text className="text-xs text-gray-500">
            {new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} · {toAdLabel(day)}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => setDay((d) => shiftDay(d, -1))}
            accessibilityLabel="Previous day"
            className="h-10 w-10 items-center justify-center rounded-lg border border-gray-200"
          >
            <Ionicons name="chevron-back" size={18} color="#374151" />
          </Pressable>
          <View style={wide ? { width: 200 } : { flex: 1 }}>
            <DateField value={day} onChange={(v) => v && setDay(v)} />
          </View>
          <Pressable
            onPress={() => setDay((d) => shiftDay(d, 1))}
            disabled={day >= today}
            accessibilityLabel="Next day"
            className="h-10 w-10 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <Ionicons name="chevron-forward" size={18} color="#374151" />
          </Pressable>
          {day !== today && (
            <Pressable
              onPress={() => setDay(today)}
              className="h-10 items-center justify-center rounded-lg px-3.5"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Text className="text-sm font-semibold text-blue-700">Today</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const pair = (left: ReactNode, right: ReactNode) =>
    wide ? (
      <View className="flex-row items-start" style={{ gap: 14 }}>
        <View className="flex-1" style={{ minWidth: 0 }}>
          {left}
        </View>
        <View className="flex-1" style={{ minWidth: 0 }}>
          {right}
        </View>
      </View>
    ) : (
      <View style={{ gap: 14 }}>
        {left}
        {right}
      </View>
    );

  const balanceLine = (
    <View
      className="flex-row flex-wrap items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3"
      style={{ gap: 8 }}
    >
      <Text className="text-[13px] text-gray-600">
        Opening {money(book.opening)} + In {money(book.totalIn)} − Out {money(book.totalOut)}
      </Text>
      <Text className="text-[15px] font-extrabold text-gray-900">
        Closing balance:{' '}
        <Text style={{ color: book.closing >= 0 ? '#2563EB' : '#DC2626' }}>NPR {money(book.closing)}</Text>
      </Text>
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: wide ? 32 : 12, paddingTop: wide ? 24 : 12, paddingBottom: 48, gap: 14 }}
    >
      {header}

      {isLoading && !transactions ? (
        <Text className="px-1 text-sm text-gray-500">Loading…</Text>
      ) : (
        <>
          {pair(
            <BookTable
              compact={!wide}
              title="Cash Inflow"
              accent="#059669"
              rows={inflowRows}
              total={book.opening + book.totalIn}
              totalLabel="Total (opening + received)"
              empty="No money received."
            />,
            <BookTable
              compact={!wide}
              title="Cash Outflow"
              accent="#DC2626"
              rows={book.outflow}
              total={book.totalOut}
              totalLabel="Total paid out"
              empty="No money paid out."
            />
          )}

          {balanceLine}

          {(book.sales.length > 0 || book.purchases.length > 0) &&
            pair(
              <BookTable
              compact={!wide}
                title="Sales bills"
                accent="#2563EB"
                rows={book.sales}
                total={book.totalSales}
                totalLabel="Total sales"
                empty="No sales."
              />,
              <BookTable
              compact={!wide}
                title="Purchase bills"
                accent="#7C3AED"
                rows={book.purchases}
                total={book.totalPurchases}
                totalLabel="Total purchases"
                empty="No purchases."
              />
            )}

          {book.moves.length > 0 && (
            <BookTable
              compact={!wide}
              title="Transfers between your accounts"
              accent="#4F46E5"
              rows={book.moves}
              total={book.totalMoves}
              totalLabel="Total moved"
              empty=""
            />
          )}

          <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
            Sales and purchase bills show what was billed that day - the money itself appears under inflow or outflow
            when it is received or paid. Tap any row to open it.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
