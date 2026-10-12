// lib/components/finance/TotalsReportScreen.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../hooks/useSupabase';
import { isSettledOnTheSpot } from '../../hooks/useAccountBalances';
import { BS_MONTHS, adStringToBs } from '../../utils/nepaliDate';
import { MONEY } from './moneyColors';
import { BackButton, BookPage, BookStat, BookStats, BookTable, Pill, ToolbarButton, money, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { BalanceFigure, EditableDetails } from './CustomerDetailScreen';
import { TransactionDetailModal } from './TransactionsScreen';
import type { BusinessTransaction } from '../../../types/database.types';

/** Total Received / Total Paid are money that actually moved; Sales / Purchase / Expense are the bills themselves, paid or not. */
type Kind = 'received' | 'paid' | 'sale' | 'purchase' | 'expense';

type NavTarget = { kind: 'transactions'; type: 'expense' | 'sale' | 'purchase' } | { kind: 'party'; partyId: string };

interface PillStyle {
  label: string;
  color: string;
  bg: string;
}

const PILL = {
  sale: { label: 'Sale', color: MONEY.in.text, bg: MONEY.in.bg },
  purchase: { label: 'Purchase', color: MONEY.out.text, bg: MONEY.out.bg },
  expense: { label: 'Expense', color: MONEY.out.text, bg: MONEY.out.bg },
  paymentReceived: { label: 'Received', color: MONEY.in.text, bg: MONEY.in.bg },
  jobPayment: { label: 'Job payment', color: MONEY.in.text, bg: MONEY.in.bg },
  paymentOut: { label: 'Paid', color: MONEY.out.text, bg: MONEY.out.bg },
  paidVendor: { label: 'Paid', color: MONEY.out.text, bg: MONEY.out.bg },
  // Only on a person's own report, for the rest of their ledger (see partyLedgerRows).
  receivable: { label: 'Receivable', color: MONEY.in.text, bg: MONEY.in.bg },
  onCredit: { label: 'Bought on credit', color: MONEY.out.text, bg: MONEY.out.bg },
} satisfies Record<string, PillStyle>;

interface Entry {
  id: string;
  date: string;
  amount: number;
  /** Who it was with - a customer, vendor or the bill's party; empty if none. */
  party: string;
  note: string;
  type: PillStyle;
  nav: NavTarget;
  /** The bill itself, for a Sales / Purchase / Expense report - what a person's own report opens in place. */
  tx?: BusinessTransaction;
}

const KIND_META: Record<Kind, { title: string; subtitle: string; color: string }> = {
  received: { title: 'Total Received', subtitle: 'Money actually collected, newest first', color: '#059669' },
  paid: { title: 'Total Paid', subtitle: 'Money that actually left the business, newest first', color: '#DC2626' },
  sale: { title: 'Sales Report', subtitle: 'Every sale bill, newest first', color: '#059669' },
  purchase: { title: 'Purchase Report', subtitle: 'Every purchase bill, newest first', color: '#DC2626' },
  expense: { title: 'Expense Report', subtitle: 'Every expense you recorded, newest first', color: '#DC2626' },
};

/** "Aswin 2083 BS" - the table's month rows. Dates are stored as AD strings
 * ('YYYY-MM-DD' or a full timestamp); Nepal reads them in Bikram Sambat. */
function bsMonthGroup(date: string): string {
  const bs = adStringToBs(date.slice(0, 10));
  return bs ? `${BS_MONTHS[bs.month]} ${bs.year} BS` : 'Other';
}
/** "Aswin 15" - the Date column. */
function bsShortDate(date: string): string {
  const bs = adStringToBs(date.slice(0, 10));
  return bs ? `${BS_MONTHS[bs.month]} ${bs.date}` : '';
}

/** `partyId` scopes a Sales / Purchase / Expense report to one person, under their name card - what
 * a person opens from the Ledger list (see usePartyDestination). It lists their bills of that kind,
 * and under them the rest of what is on their ledger (payments in and out), so nothing recorded
 * for them is missing from the page. */
export function TotalsReportScreen({ kind, basePath, partyId }: { kind: Kind; basePath: string; partyId?: string }) {
  const meta = KIND_META[kind];
  const layout = useBookLayout();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [viewingTx, setViewingTx] = useState<BusinessTransaction | null>(null);
  // The person's own two ledgers, every entry (a balance is a sum over all of them) - for the
  // balance on their name card. Not read for the plain reports.
  const { data: partyCustomerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: { customer_id: partyId ?? '' },
    all: true,
    enabled: !!partyId,
  });
  const { data: partyVendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: { vendor_id: partyId ?? '' },
    all: true,
    enabled: !!partyId,
  });
  const { data: partyRow } = useSupabaseRow('customers', partyId);
  // Every bill of this report's kind, not the capped first 1000 of all bills the plain reports
  // read - a person's report must not lose a bill just because the account has grown. Matched to
  // the person in `entries` below.
  const { data: kindBills } = useSupabaseQuery('business_transactions', {
    filters: userId && partyId ? { owner_id: userId, type: kind } : {},
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!userId && !!partyId,
  });
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: ledgerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: categories } = useSupabaseQuery('expense_categories', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);
  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const year = new Date().getFullYear();

  // A person's report is a page of its own, titled for its kind, with a way back to the list they
  // came from and to their full ledger (statement, payments, Print / Download).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`${basePath}/customers` as never);
  };
  const toolbar = useBookToolbar(
    {
      title: partyId ? meta.title : undefined,
      wide: layout.wide,
      left: layout.wide && !partyId ? undefined : () => <BackButton onPress={goBack} />,
      right: partyId
        ? () => <ToolbarButton icon="book-outline" label="Open ledger" onPress={() => router.push(`${basePath}/customer/${partyId}` as never)} />
        : undefined,
    },
    [partyId, basePath]
  );

  // "Received" = every payment actually collected from a customer, whether
  // logged manually (Payment In) or synced from a paid booking - NOT Sales,
  // which since 0061_sale_purchase_always_ledger.sql book a debt rather than
  // cash received. "Paid" = real cash out: Expenses, manual Payment Out to a
  // customer, and payments actually made to a vendor - a Purchase itself is
  // a debt too now, not cash spent, same as booking-sourced debit entries
  // are excluded since those represent money owed, not money that's left
  // the business yet.
  const entries = useMemo((): Entry[] => {
    // A Sales / Purchase / Expense report is just that kind of bill - every one, whether or not the
    // money has moved yet - so none of the cash rules below apply to it.
    if (kind === 'sale' || kind === 'purchase' || kind === 'expense') {
      // On a person's own report: a bill linked to them - or one not linked to anybody but made out to
      // their exact name (a payee typed in, or an expense category named for them), as those are
      // the bills their ledger would otherwise seem to be missing.
      const personName = partyRow?.name.trim().toLowerCase() ?? '';
      const named = (s: string | null | undefined) => !!personName && !!s && s.trim().toLowerCase() === personName;
      const isTheirs = (t: BusinessTransaction) =>
        t.customer_id === partyId ||
        (!t.customer_id &&
          (named(t.party_name) || (kind === 'expense' && named(t.expense_category_id ? categoryById.get(t.expense_category_id) : null))));
      return (partyId ? kindBills ?? [] : transactions ?? [])
        .filter((t) => t.type === kind && (!partyId || isTheirs(t)))
        .map((t): Entry => {
          // The expense report shows the category (same one picked in the entry portal) in
          // place of the generic "Expense" type - the title still falls back to it when there's no party.
          const category = t.expense_category_id ? categoryById.get(t.expense_category_id) : undefined;
          return {
            id: t.id,
            date: t.bill_date ?? t.created_at,
            amount: t.amount,
            party: t.party_name ?? '',
            note:
              kind === 'expense'
                ? t.note ?? ''
                : [t.bill_no ? `Bill #${t.bill_no}` : null, t.note].filter(Boolean).join(' · '),
            type: kind === 'expense' ? { label: category ?? 'Uncategorized', color: MONEY.out.text, bg: MONEY.out.bg } : PILL[kind],
            // A bill to a saved customer / vendor opens that party's ledger; a walk-in or expense has none.
            nav: t.customer_id && kind !== 'expense' ? { kind: 'party', partyId: t.customer_id } : { kind: 'transactions', type: kind },
            tx: t,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    const list: Entry[] = [];
    for (const t of transactions ?? []) {
      // A Sale/Purchase with no party has no ledger to settle it later (a
      // paid walk-in job, a delivered cash-on-delivery order) - its money
      // moved on the spot. Same rule as useAccountBalances.
      if (isSettledOnTheSpot(t) && (kind === 'received') === (t.type === 'sale')) {
        list.push({
          id: t.id,
          date: t.bill_date ?? t.created_at,
          amount: t.amount,
          party: t.party_name ?? '',
          note: t.note ?? '',
          type: t.type === 'sale' ? PILL.sale : PILL.purchase,
          nav: { kind: 'transactions', type: t.type === 'sale' ? 'sale' : 'purchase' },
        });
      }
      if (kind === 'paid' && t.type === 'expense') {
        // Same as the Transactions list: the payee if there is one, else the category.
        const category = t.expense_category_id ? categoryById.get(t.expense_category_id) : undefined;
        list.push({
          id: t.id,
          date: t.bill_date ?? t.created_at,
          amount: t.amount,
          party: t.party_name || category || '',
          note: [t.party_name ? category : null, t.note].filter(Boolean).join(' · '),
          type: PILL.expense,
          nav: { kind: 'transactions', type: 'expense' },
        });
      }
    }
    for (const e of ledgerEntries ?? []) {
      const customerName = nameById.get(e.customer_id) ?? 'Unknown customer';
      if (kind === 'received' && e.entry_type === 'credit') {
        list.push({
          id: e.id,
          date: e.entry_date ?? e.created_at,
          amount: e.amount,
          party: customerName,
          note: e.note ?? '',
          type: e.source === 'booking' ? PILL.jobPayment : PILL.paymentReceived,
          nav: { kind: 'party', partyId: e.customer_id },
        });
      }
      if (kind === 'paid' && e.entry_type === 'debit' && e.source === 'manual') {
        list.push({
          id: e.id,
          date: e.entry_date ?? e.created_at,
          amount: e.amount,
          party: customerName,
          note: e.note ?? '',
          type: PILL.paymentOut,
          nav: { kind: 'party', partyId: e.customer_id },
        });
      }
    }
    if (kind === 'paid') {
      for (const e of vendorEntries ?? []) {
        if (e.entry_type === 'credit') {
          list.push({
            id: e.id,
            date: e.entry_date ?? e.created_at,
            amount: e.amount,
            party: nameById.get(e.vendor_id) ?? 'Unknown vendor',
            note: e.note ?? '',
            type: PILL.paidVendor,
            nav: { kind: 'party', partyId: e.vendor_id },
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, kindBills, partyRow, ledgerEntries, vendorEntries, nameById, categoryById, kind, partyId]);

  // The rest of what is on a person's ledger - money received from or paid to them, and what they
  // owe or are owed outside a bill - listed under their bills so the page shows all of it. The
  // entry a Sale / Purchase posts is left out: it is the bill itself, listed above.
  const partyLedgerRows = useMemo((): Entry[] => {
    if (!partyId) return [];
    const rows: Entry[] = [];
    const nav: NavTarget = { kind: 'party', partyId };
    for (const e of partyCustomerEntries ?? []) {
      if (e.source_type === 'business_transaction') continue;
      const manual = e.source === 'manual';
      rows.push({
        id: e.id,
        date: e.entry_date ?? e.created_at,
        amount: Number(e.amount),
        party: '',
        note: [e.receipt_no ? `No. ${e.receipt_no}` : null, e.note].filter(Boolean).join(' · '),
        type: e.entry_type === 'credit' ? (manual ? PILL.paymentReceived : PILL.jobPayment) : manual ? PILL.paymentOut : PILL.receivable,
        nav,
      });
    }
    for (const e of partyVendorEntries ?? []) {
      if (e.source_type === 'business_transaction') continue;
      rows.push({
        id: e.id,
        date: e.entry_date ?? e.created_at,
        amount: Number(e.amount),
        party: '',
        note: [e.receipt_no ? `No. ${e.receipt_no}` : null, e.note].filter(Boolean).join(' · '),
        type: e.entry_type === 'credit' ? PILL.paidVendor : PILL.onCredit,
        nav,
      });
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [partyId, partyCustomerEntries, partyVendorEntries]);

  // The plain reports are this year's; a person's own report is all of their bills - one
  // person has few, and an old one should not look like there is nothing.
  const yearEntries = useMemo(
    () => (partyId ? entries : entries.filter((e) => new Date(e.date).getFullYear() === year)),
    [entries, year, partyId]
  );

  const stats = useMemo(() => {
    const now = new Date();
    let total = 0;
    let thisMonth = 0;
    let largest = 0;
    for (const e of yearEntries) {
      total += e.amount;
      largest = Math.max(largest, e.amount);
      const d = new Date(e.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonth += e.amount;
    }
    return { total, thisMonth, largest };
  }, [yearEntries]);

  // Where the person stands, both of their ledgers netted - the same figure and wording as on
  // their ledger page's name card.
  const partyBalance = useMemo(() => {
    const sum = (rows: { entry_type: string; amount: number }[]) =>
      rows.reduce((s, e) => s + (e.entry_type === 'debit' ? Number(e.amount) : -Number(e.amount)), 0);
    const net = Math.round(sum(partyCustomerEntries ?? []) - sum(partyVendorEntries ?? []));
    const words =
      net > 0
        ? { label: 'To receive', color: MONEY.in.text }
        : net < 0
          ? { label: 'To pay', color: MONEY.out.text }
          : { label: 'Balance', color: '#374151' };
    return { ...words, value: `NPR ${Math.abs(net).toLocaleString()}` };
  }, [partyCustomerEntries, partyVendorEntries]);

  const open = (e: Entry) => {
    // On a person's own report a bill opens in place, rather than leaving for a list of every bill.
    if (partyId && e.tx) {
      setViewingTx(e.tx);
      return;
    }
    router.push(
      (e.nav.kind === 'transactions' ? `${basePath}/transactions?type=${e.nav.type}` : `${basePath}/customer/${e.nav.partyId}`) as never
    );
  };

  const amountCell = (e: Entry) => (
    <Text className="text-[12.5px] font-bold" style={{ color: meta.color }} numberOfLines={1}>
      {money(e.amount)}
    </Text>
  );
  const chevron = () => <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />;

  const detailsCell = (e: Entry, compact: boolean) => (
    <View style={{ minWidth: 0, gap: 2 }}>
      <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
        {e.party || e.type.label}
      </Text>
      {compact && <Pill text={e.type.label} color={e.type.color} bg={e.type.bg} />}
      {(!!e.note || compact) && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          {[compact ? bsShortDate(e.date) : null, e.note].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );

  const columnsFor = (typeLabel: string, amount: (e: Entry) => ReactNode): BookColumn<Entry>[] =>
    layout.full
      ? [
          { key: 'date', label: 'Date', width: 104, render: (e) => <Text className="text-[12.5px] text-gray-500">{bsShortDate(e.date)}</Text> },
          { key: 'details', label: 'Details', render: (e) => detailsCell(e, false) },
          { key: 'type', label: typeLabel, width: 150, render: (e) => <Pill text={e.type.label} color={e.type.color} bg={e.type.bg} /> },
          { key: 'amount', label: 'Amount', width: 130, align: 'right', render: amount },
          { key: 'act', label: '', width: 34, align: 'right', render: chevron },
        ]
      : [
          { key: 'details', label: 'Details', render: (e) => detailsCell(e, true) },
          { key: 'amount', label: 'Amount', width: 96, align: 'right', render: amount },
          { key: 'act', label: '', width: 30, align: 'right', render: chevron },
        ];
  const columns = columnsFor(kind === 'expense' ? 'Category' : 'Type', amountCell);
  // A payment's colour is its own direction (green in, red out), not the report's.
  const ledgerColumns = columnsFor('Type', (e) => (
    <Text className="text-[12.5px] font-bold" style={{ color: e.type.color }} numberOfLines={1}>
      {money(e.amount)}
    </Text>
  ));

  return (
    <>
    <BookPage wide={layout.wide}>
      {toolbar}

      {partyId && (
        <EditableDetails
          customerId={partyId}
          basePath={basePath}
          summary={<BalanceFigure label={partyBalance.label} value={partyBalance.value} color={partyBalance.color} />}
        />
      )}

      <BookStats>
        <BookStat label={partyId ? 'Total' : `${year} total`} value={`NPR ${money(stats.total)}`} color={meta.color} />
        <BookStat label="This month" value={`NPR ${money(stats.thisMonth)}`} color="#374151" />
        <BookStat label="Entries" value={String(yearEntries.length)} color="#374151" />
        <BookStat label="Largest" value={`NPR ${money(stats.largest)}`} color="#374151" />
      </BookStats>

      {yearEntries.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-10">
          <Ionicons name="cash-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">
            {partyId ? `No ${kind} bills recorded for ${partyRow?.name ?? 'this person'}.` : 'Nothing here yet.'}
          </Text>
        </View>
      ) : (
        <BookTable
          columns={columns}
          rows={yearEntries}
          rowKey={(e) => e.id}
          onRowPress={open}
          groupOf={(e) => bsMonthGroup(e.date)}
          footer={{
            label: `${yearEntries.length} ${yearEntries.length === 1 ? 'entry' : 'entries'} · Total`,
            cells: { amount: <Text className="text-[13px] font-extrabold" style={{ color: meta.color }}>{money(stats.total)}</Text> },
          }}
        />
      )}

      {partyId && partyLedgerRows.length > 0 && (
        <>
          <Text className="px-1 pt-1 text-[13px] font-bold text-gray-700">
            Payments and other ledger entries ({partyLedgerRows.length})
          </Text>
          <BookTable
            columns={ledgerColumns}
            rows={partyLedgerRows}
            rowKey={(e) => e.id}
            onRowPress={open}
            groupOf={(e) => bsMonthGroup(e.date)}
          />
        </>
      )}

      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        {partyId
          ? 'Tap a bill to open it; tap a payment to open their ledger, where it can be edited. The balance above counts every entry of both ledgers, including these.'
          : kind === 'received'
            ? 'Tap an entry to open it. Only money actually collected counts here - a sale bill on credit shows up once the customer pays.'
            : kind === 'paid'
              ? 'Tap an entry to open it. Only money that actually left counts here - a purchase bill on credit shows up once you pay the vendor.'
              : `Tap an entry to open it. Every ${kind} bill counts here, whether or not the money has moved yet - see Total ${kind === 'sale' ? 'Received' : 'Paid'} for what actually has.`}
      </Text>
    </BookPage>
    <TransactionDetailModal
      tx={viewingTx}
      categoryName={viewingTx?.expense_category_id ? categoryById.get(viewingTx.expense_category_id) ?? null : null}
      bankAccountName={null}
      onClose={() => setViewingTx(null)}
      onEdit={() => {
        if (viewingTx) router.push(`${basePath}/transactions?type=${viewingTx.type}&add=1&edit=${viewingTx.id}` as never);
        setViewingTx(null);
      }}
    />
    </>
  );
}

/** A person's own Sales / Purchase / Expense report: what a person with that Ledger type opens
 * from the Ledger list (see usePartyDestination). Its own route rather than a parameter on the
 * plain reports, because tab screens stay mounted - a filter left on one would still be there the
 * next time the plain report was opened from the side panel. */
export function PartyReportScreen({ basePath }: { basePath: string }) {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  if (!id || (kind !== 'sale' && kind !== 'purchase' && kind !== 'expense')) {
    return <Redirect href={`${basePath}/customers` as never} />;
  }
  // Keyed, so another person's report starts from its own state.
  return <TotalsReportScreen key={`${id}-${kind}`} kind={kind} basePath={basePath} partyId={id} />;
}
