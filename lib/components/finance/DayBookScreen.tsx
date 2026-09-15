// lib/components/finance/DayBookScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { DateField } from '../DateTimeFields';
import { useWideDetail } from '../detail/DetailLayout';
import { toAdLabel, toBsLabel } from '../../utils/nepaliDate';

type Direction = 'in' | 'out' | 'booked' | 'transfer';

type DayRow = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
  direction: Direction;
  party: string;
  detail: string | null;
  mode: string;
  amount: number;
  time: string;
  sortKey: string;
  href: string;
};

const KIND = {
  sale: { label: 'Sale', icon: 'trending-up', color: '#059669', tint: '#ECFDF5' },
  purchase: { label: 'Purchase', icon: 'cart', color: '#DC2626', tint: '#FEF2F2' },
  expense: { label: 'Expense', icon: 'receipt', color: '#D97706', tint: '#FFFBEB' },
  paymentIn: { label: 'Payment in', icon: 'arrow-down-circle', color: '#059669', tint: '#ECFDF5' },
  paymentOut: { label: 'Payment out', icon: 'arrow-up-circle', color: '#DC2626', tint: '#FEF2F2' },
  transfer: { label: 'Transfer', icon: 'swap-horizontal', color: '#4F46E5', tint: '#EEF2FF' },
} as const;

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

function npr(n: number): string {
  return `NPR ${Math.round(n).toLocaleString()}`;
}

/** Every money movement recorded for one day, on one page. Uses the same
 * definitions as the Finance dashboard: a Sale or Purchase books a debt (not
 * cash), money in is a payment received, and money out is an expense or a
 * payment made. The ledger rows a Sale/Purchase creates automatically are
 * left out so nothing is counted twice. Entries are placed on the date the
 * user gave them (bill/payment date), not when they were typed in. */
export function DayBookScreen({ basePath }: { basePath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useWideDetail();
  const [day, setDay] = useState(() => localDay(new Date().toISOString()));
  const today = localDay(new Date().toISOString());

  const owner: Record<string, string> = userId ? { owner_id: userId } : {};
  const { data: transactions, isLoading: loadingTx } = useSupabaseQuery('business_transactions', { filters: owner, enabled: !!userId });
  const { data: customerEntries } = useSupabaseQuery('customer_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', { filters: owner, enabled: !!userId });
  const { data: transfers } = useSupabaseQuery('account_transfers', { filters: owner, enabled: !!userId });
  const { data: contacts } = useSupabaseQuery('customers', { filters: owner, enabled: !!userId });
  const { data: accounts } = useSupabaseQuery('bank_accounts', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });
  const { data: categories } = useSupabaseQuery('expense_categories', { filters: owner, orderBy: { column: 'name' }, enabled: !!userId });

  const contactName = useMemo(() => new Map((contacts ?? []).map((c) => [c.id, c.name])), [contacts]);
  const accountName = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a.name])), [accounts]);
  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo((): DayRow[] => {
    const out: DayRow[] = [];
    const modeOf = (bankId: string | null) => (bankId ? (accountName.get(bankId) ?? 'Bank') : 'Cash');

    for (const t of transactions ?? []) {
      if ((t.bill_date ?? localDay(t.created_at)) !== day) continue;
      const k = KIND[t.type];
      const mode = t.payment_mode === 'credit' ? 'Credit' : t.payment_mode === 'bank' ? modeOf(t.bank_account_id) : 'Cash';
      const category = t.expense_category_id ? categoryName.get(t.expense_category_id) : null;
      out.push({
        id: `t-${t.id}`,
        ...k,
        direction: t.type === 'expense' ? 'out' : 'booked',
        party: t.party_name || category || k.label,
        detail: [t.bill_no ? `Bill #${t.bill_no}` : null, t.type === 'expense' && t.party_name ? category : null, t.note]
          .filter(Boolean)
          .join(' · ') || null,
        mode,
        amount: t.amount,
        time: timeOf(t.created_at),
        sortKey: t.created_at,
        href: `${basePath}/transactions?type=${t.type}`,
      });
    }

    for (const e of customerEntries ?? []) {
      if ((e.entry_date ?? localDay(e.created_at)) !== day) continue;
      // Booking debits are the Sale itself, already listed above.
      if (e.entry_type === 'debit' && e.source !== 'manual') continue;
      const k = e.entry_type === 'credit' ? KIND.paymentIn : KIND.paymentOut;
      out.push({
        id: `c-${e.id}`,
        ...k,
        direction: e.entry_type === 'credit' ? 'in' : 'out',
        party: contactName.get(e.customer_id) ?? 'Customer',
        detail: [e.receipt_no ? `Receipt #${e.receipt_no}` : null, e.note].filter(Boolean).join(' · ') || null,
        mode: modeOf(e.bank_account_id),
        amount: e.amount,
        time: timeOf(e.created_at),
        sortKey: e.created_at,
        href: `${basePath}/customer/${e.customer_id}`,
      });
    }

    for (const e of vendorEntries ?? []) {
      if ((e.entry_date ?? localDay(e.created_at)) !== day) continue;
      // Only real payments to a vendor move money; debits are the Purchase.
      if (e.entry_type !== 'credit') continue;
      out.push({
        id: `v-${e.id}`,
        ...KIND.paymentOut,
        direction: 'out',
        party: contactName.get(e.vendor_id) ?? 'Vendor',
        detail: [e.receipt_no ? `Receipt #${e.receipt_no}` : null, e.note].filter(Boolean).join(' · ') || null,
        mode: modeOf(e.bank_account_id),
        amount: e.amount,
        time: timeOf(e.created_at),
        sortKey: e.created_at,
        href: `${basePath}/customer/${e.vendor_id}`,
      });
    }

    for (const tr of transfers ?? []) {
      if ((tr.transfer_date ?? localDay(tr.created_at)) !== day) continue;
      out.push({
        id: `x-${tr.id}`,
        ...KIND.transfer,
        direction: 'transfer',
        party: `${modeOf(tr.from_account_id)} → ${modeOf(tr.to_account_id)}`,
        detail: tr.note,
        mode: 'Between accounts',
        amount: tr.amount,
        time: timeOf(tr.created_at),
        sortKey: tr.created_at,
        href: `${basePath}/bank-accounts`,
      });
    }

    return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [transactions, customerEntries, vendorEntries, transfers, day, basePath, contactName, accountName, categoryName]);

  const totals = useMemo(() => {
    const t = { sales: 0, purchases: 0, moneyIn: 0, moneyOut: 0 };
    for (const r of rows) {
      if (r.label === 'Sale') t.sales += r.amount;
      else if (r.label === 'Purchase') t.purchases += r.amount;
      if (r.direction === 'in') t.moneyIn += r.amount;
      if (r.direction === 'out') t.moneyOut += r.amount;
    }
    return t;
  }, [rows]);
  const net = totals.moneyIn - totals.moneyOut;

  const tiles = [
    { label: 'Money in', value: totals.moneyIn, color: '#059669', icon: 'arrow-down-circle' as const },
    { label: 'Money out', value: totals.moneyOut, color: '#DC2626', icon: 'arrow-up-circle' as const },
    { label: 'Net for the day', value: net, color: net >= 0 ? '#2563EB' : '#DC2626', icon: 'wallet' as const },
    { label: 'Sales', value: totals.sales, color: '#111827', icon: 'trending-up' as const },
    { label: 'Purchases', value: totals.purchases, color: '#111827', icon: 'cart' as const },
  ];

  const dateBar = (
    <View className="rounded-2xl border border-gray-200 bg-white p-4" style={{ gap: 12, ...(wide ? { maxWidth: 520 } : null) }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Pressable
          onPress={() => setDay((d) => shiftDay(d, -1))}
          accessibilityLabel="Previous day"
          className="h-11 w-11 items-center justify-center rounded-xl border border-gray-200"
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-[17px] font-extrabold text-gray-900">{toBsLabel(day)}</Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            {new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} · {toAdLabel(day)}
          </Text>
        </View>
        <Pressable
          onPress={() => setDay((d) => shiftDay(d, 1))}
          disabled={day >= today}
          accessibilityLabel="Next day"
          className="h-11 w-11 items-center justify-center rounded-xl border border-gray-200 disabled:opacity-30"
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </Pressable>
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1">
          <DateField value={day} onChange={(v) => v && setDay(v)} />
        </View>
        {day !== today && (
          <Pressable onPress={() => setDay(today)} className="h-10 items-center justify-center rounded-lg px-4" style={{ backgroundColor: '#EFF6FF' }}>
            <Text className="text-sm font-semibold text-blue-700">Today</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const summary = (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {tiles.map((tile, i) => (
        <View
          key={tile.label}
          className="rounded-2xl border border-gray-200 bg-white p-3.5"
          style={{
            flexGrow: 1,
            flexBasis: wide ? 150 : i < 2 ? '45%' : i === 2 ? '100%' : '45%',
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <Ionicons name={tile.icon} size={14} color={tile.color} />
            <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tile.label}</Text>
          </View>
          <Text className="mt-1.5 text-lg font-extrabold" style={{ color: tile.color }}>
            {tile.label === 'Net for the day' && net > 0 ? '+' : ''}
            {npr(tile.value)}
          </Text>
        </View>
      ))}
    </View>
  );

  const amountText = (r: DayRow) => {
    if (r.direction === 'in') return { text: `+ ${npr(r.amount)}`, color: '#059669' };
    if (r.direction === 'out') return { text: `− ${npr(r.amount)}`, color: '#DC2626' };
    return { text: npr(r.amount), color: '#374151' };
  };

  const typePill = (r: DayRow) => (
    <View className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1" style={{ backgroundColor: r.tint }}>
      <Ionicons name={r.icon} size={12} color={r.color} />
      <Text className="text-[11.5px] font-semibold" style={{ color: r.color }}>
        {r.label}
      </Text>
    </View>
  );

  const list = (
    <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <Text className="text-[15px] font-bold text-gray-900">Entries</Text>
        <Text className="text-xs text-gray-500">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>

      {wide && rows.length > 0 && (
        <View className="flex-row border-b border-gray-100 px-4 py-2" style={{ gap: 14 }}>
          {[
            ['Time', { width: 52 }],
            ['Type', { width: 120 }],
            ['Party & details', { flex: 1 }],
            ['Mode', { width: 130 }],
            ['Amount', { width: 150, textAlign: 'right' }],
          ].map(([label, style]) => (
            <Text key={label as string} className="text-[11px] font-bold uppercase tracking-wide text-gray-400" style={style as object}>
              {label as string}
            </Text>
          ))}
        </View>
      )}

      {loadingTx && rows.length === 0 ? (
        <Text className="px-4 py-6 text-sm text-gray-500">Loading…</Text>
      ) : rows.length === 0 ? (
        <View className="items-center px-4 py-10">
          <Ionicons name="book-outline" size={30} color="#D1D5DB" />
          <Text className="mt-2 text-sm text-gray-500">Nothing recorded on this day.</Text>
        </View>
      ) : (
        rows.map((r, i) => {
          const amt = amountText(r);
          const border = i < rows.length - 1 ? 'border-b border-gray-100' : '';
          if (wide) {
            return (
              <Pressable key={r.id} onPress={() => router.push(r.href as any)} className={`flex-row items-center px-4 py-3 ${border}`} style={{ gap: 14 }}>
                <Text className="text-[13px] text-gray-500" style={{ width: 52 }}>
                  {r.time}
                </Text>
                <View style={{ width: 120 }}>{typePill(r)}</View>
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-gray-900" numberOfLines={1}>
                    {r.party}
                  </Text>
                  {!!r.detail && (
                    <Text className="text-xs text-gray-400" numberOfLines={1}>
                      {r.detail}
                    </Text>
                  )}
                </View>
                <Text className="text-[13px] text-gray-600" style={{ width: 130 }} numberOfLines={1}>
                  {r.mode}
                </Text>
                <Text className="text-right text-[14.5px] font-bold" style={{ width: 150, color: amt.color }}>
                  {amt.text}
                </Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={r.id} onPress={() => router.push(r.href as any)} className={`px-4 py-3 ${border}`} style={{ gap: 6 }}>
              <View className="flex-row items-center justify-between">
                {typePill(r)}
                <Text className="text-[15px] font-bold" style={{ color: amt.color }}>
                  {amt.text}
                </Text>
              </View>
              <Text className="text-[14px] font-semibold text-gray-900" numberOfLines={1}>
                {r.party}
              </Text>
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {[r.time, r.mode, r.detail].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          );
        })
      )}

      {rows.length > 0 && (
        <View className="flex-row items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <Text className="text-sm font-bold text-gray-900">Net for the day</Text>
          <Text className="text-base font-extrabold" style={{ color: net >= 0 ? '#2563EB' : '#DC2626' }}>
            {net > 0 ? '+ ' : net < 0 ? '− ' : ''}
            {npr(Math.abs(net))}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: wide ? 32 : 16, paddingTop: wide ? 24 : 16, paddingBottom: 48, gap: 14 }}
    >
      {/* Stacked on every width: beside the date bar the five totals wrapped
          into 4 + 1 on a laptop, stranding Purchases on its own row. */}
      {dateBar}
      {summary}
      {list}
      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        Sales and purchases are shown as booked amounts - the money itself counts once it is paid (Payment in / Payment
        out). Transfers only move money between your own accounts.
      </Text>
    </ScrollView>
  );
}
