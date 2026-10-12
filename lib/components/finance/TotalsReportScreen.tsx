// lib/components/finance/TotalsReportScreen.tsx
import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../hooks/useSupabase';
import { usePartyTypes } from '../../hooks/usePartyTypes';
import { isStaffLedgerType, reportKindOfType, usePartyDestination } from '../../hooks/usePartyDestination';
import { isSettledOnTheSpot } from '../../hooks/useAccountBalances';
import { BS_MONTHS, adStringToBs } from '../../utils/nepaliDate';
import { groupExpenseNames, nameKey } from '../../utils/expenseGroups';
import { MONEY } from './moneyColors';
import { BackButton, BookPage, BookStat, BookStats, BookTable, Pill, ToolbarButton, money, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { BalanceFigure, EditableDetails } from './CustomerDetailScreen';
import { TransactionDetailModal } from './TransactionsScreen';
import { InlineSelect } from './ledger/LedgerUi';
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
  /** What an expense is filed under - its category, or the ledger a payment went to. The Expense
   * Report is grouped by it (see groupExpenseNames). */
  category?: string;
  /** Money received or paid on a ledger, listed beside a Sales / Purchase report's bills. It settles
   * bills, so it is not part of what was billed (that would count a sale and its receipt twice). */
  payment?: boolean;
  /** Where tapping it goes, when that is not the person's ledger page (see usePartyDestination). */
  href?: string;
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
  // Every row: a plain read stops at the API's first 1000, unordered, and a report that quietly
  // drops its older rows is worse than a slow one. (The ordering gives each read a cache entry of
  // its own - the key ignores `columns`, so these must not share one with a narrow read.)
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!userId,
  });
  const { data: ledgerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!userId,
  });
  const { data: vendorEntries } = useSupabaseQuery('vendor_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    all: true,
    enabled: !!userId,
  });
  const { data: customers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { nameById: partyTypeName } = usePartyTypes(userId);
  // Where a person opens from a report (the report for their Ledger type, else their ledger).
  const hrefFor = usePartyDestination(userId, basePath);
  // What is recorded on a person's own ledger page belongs in the report their Ledger type stands for:
  //  - Expense: what is paid to the ledger is an expense even though it is a payment on their
  //    ledger, not through the Expense form. An Expense ledger is itself a category: its payments are
  //    filed under its name.
  //  - Employee: a person, not a category: their payments are filed under the existing category the
  //    remark names ("FUEL" -> Fuel), else Uncategorized. The category list is never added to by a person.
  //  - Sales / Purchase: the money received from / paid to the ledger, listed beside its bills.
  const { expenseLedgerIds, staffLedgerIds, saleLedgerIds, purchaseLedgerIds } = useMemo(() => {
    const expense = new Set<string>();
    const staff = new Set<string>();
    const sale = new Set<string>();
    const purchase = new Set<string>();
    for (const c of customers ?? []) {
      const typeName = c.party_type_id ? partyTypeName.get(c.party_type_id) : undefined;
      const typed = reportKindOfType(typeName);
      if (typed === 'expense') expense.add(c.id);
      else if (typed === 'sale') sale.add(c.id);
      else if (typed === 'purchase') purchase.add(c.id);
      else if (isStaffLedgerType(typeName)) staff.add(c.id);
    }
    return { expenseLedgerIds: expense, staffLedgerIds: staff, saleLedgerIds: sale, purchaseLedgerIds: purchase };
  }, [customers, partyTypeName]);
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
  // The person's page is titled for what they are - their Ledger type, as on their ledger page - and
  // never says "Report"; failing a type, the kind it lists (Expense, Sales, Purchase).
  const personType = partyRow?.party_type_id ? partyTypeName.get(partyRow.party_type_id) : undefined;
  const personTitle = personType || meta.title.replace(/\s*report$/i, '');
  const toolbar = useBookToolbar(
    {
      title: partyId ? personTitle : undefined,
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
      const rows = (partyId ? kindBills ?? [] : transactions ?? [])
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
            // Expense: filed under its category. Sales / Purchase: under who it was with, which is what
            // those reports are grouped by.
            category:
              kind === 'expense'
                ? category ?? 'Uncategorized'
                : (t.customer_id ? nameById.get(t.customer_id) : undefined) || t.party_name?.trim() || 'No party',
          };
        });
      // An expense is often not a bill at all: money paid to a ledger typed Expense (Bike Repair, Fuel
      // ...) is recorded as a payment on that ledger. So the Expense Report - and an Expense ledger's
      // own page - lists what is on those ledgers too, filed under the ledger's name (its category):
      //   Paid (money out)                    -> an expense, added;
      //   Received (money back from them)     -> a refund, taken off: a negative row.
      // Whatever is entered from the ledger's own page is in here, so it is in the report. (The
      // copy a Sale / Purchase posts is the bill itself, listed above, so it is left out.)
      if (kind === 'expense') {
        // The categories that exist: the expense categories and the Expense ledgers' names - a
        // payment to an employee is filed under one of these when its remark names it.
        const knownCategory = new Map<string, string>();
        for (const c of categories ?? []) knownCategory.set(nameKey(c.name), c.name.trim());
        for (const id of expenseLedgerIds) {
          const name = nameById.get(id);
          if (name) knownCategory.set(nameKey(name), name.trim());
        }
        const ledgerRow = (
          e: { id: string; entry_date: string | null; created_at: string; amount: number; receipt_no: string | null; note: string | null },
          ledgerId: string,
          refund: boolean
        ): Entry => {
          const name = nameById.get(ledgerId) ?? partyRow?.name ?? 'Expense ledger';
          const tone = refund ? MONEY.in : MONEY.out;
          // An Expense ledger is its own category; a person's payment goes under the category its
          // remark names, else Uncategorized - so the list of categories is not theirs to grow.
          const isStaff = staffLedgerIds.has(ledgerId);
          const category = isStaff ? knownCategory.get(nameKey(e.note ?? '')) ?? 'Uncategorized' : name;
          return {
            id: e.id,
            date: e.entry_date ?? e.created_at,
            amount: refund ? -Number(e.amount) : Number(e.amount),
            party: `${refund ? 'Received from' : 'Paid to'} ${name}`,
            note: [e.receipt_no ? `${refund ? 'Receipt' : 'Payment'} no. ${e.receipt_no}` : null, refund ? 'Refund' : null, e.note]
              .filter(Boolean)
              .join(' · '),
            type: { label: category, color: tone.text, bg: tone.bg },
            nav: { kind: 'party', partyId: ledgerId },
            category,
            // On the ledger's own page a row goes to its ledger, where it can be edited.
            href: partyId ? `${basePath}/customer/${ledgerId}` : hrefFor(ledgerId),
          };
        };
        const customerSide = partyId ? partyCustomerEntries ?? [] : ledgerEntries ?? [];
        const vendorSide = partyId ? partyVendorEntries ?? [] : vendorEntries ?? [];
        const counts = (ledgerId: string) =>
          partyId ? ledgerId === partyId : expenseLedgerIds.has(ledgerId) || staffLedgerIds.has(ledgerId);
        for (const e of customerSide) {
          if (counts(e.customer_id) && e.source === 'manual') rows.push(ledgerRow(e, e.customer_id, e.entry_type === 'credit'));
        }
        for (const e of vendorSide) {
          if (counts(e.vendor_id) && e.entry_type === 'credit') rows.push(ledgerRow(e, e.vendor_id, false));
        }
      } else {
        // Sales / Purchase: every ledger feeds them, whatever its type, by which way the money went -
        // what was received on a ledger is a sale, what was paid on one is a purchase (an Expense or
        // Employee ledger is the Expense Report's, not these). The copy a bill posts to the ledger is
        // the bill itself, listed above, so it is left out.
        //
        // Counting: a person with bills of this kind has their payments listed but not added (they
        // settle those bills - a sale and its receipt would count twice); a person with NO bills of this
        // kind has had nothing else recorded, so what was received / paid is the sale / purchase.
        const salesSide = kind === 'sale';
        const billed = new Set<string>();
        for (const row of rows) if (row.tx?.customer_id) billed.add(row.tx.customer_id);
        const hasBills = (ledgerId: string) => (partyId ? rows.length > 0 : billed.has(ledgerId));
        const ledgerRow = (
          e: { id: string; entry_date: string | null; created_at: string; amount: number; receipt_no: string | null; note: string | null },
          ledgerId: string,
          moneyIn: boolean
        ): Entry => {
          const name = nameById.get(ledgerId) ?? partyRow?.name ?? 'Ledger';
          return {
            id: e.id,
            date: e.entry_date ?? e.created_at,
            amount: Number(e.amount),
            party: `${moneyIn ? 'Received from' : 'Paid to'} ${name}`,
            note: [e.receipt_no ? `${moneyIn ? 'Receipt' : 'Payment'} no. ${e.receipt_no}` : null, e.note].filter(Boolean).join(' · '),
            type: moneyIn ? PILL.paymentReceived : PILL.paymentOut,
            nav: { kind: 'party', partyId: ledgerId },
            category: name,
            // Listed but not added up when it settles a bill of theirs.
            payment: hasBills(ledgerId),
            href: partyId ? `${basePath}/customer/${ledgerId}` : hrefFor(ledgerId),
          };
        };
        const customerSide = partyId ? partyCustomerEntries ?? [] : ledgerEntries ?? [];
        const vendorSide = partyId ? partyVendorEntries ?? [] : vendorEntries ?? [];
        const counts = (ledgerId: string) =>
          partyId ? ledgerId === partyId : !expenseLedgerIds.has(ledgerId) && !staffLedgerIds.has(ledgerId);
        for (const e of customerSide) {
          if (!counts(e.customer_id) || e.source_type === 'business_transaction') continue;
          if (salesSide && e.entry_type === 'credit') rows.push(ledgerRow(e, e.customer_id, true));
          // Money paid out on the customer ledger (the older way of recording a payment) is a purchase's.
          else if (!salesSide && e.entry_type === 'debit' && e.source === 'manual') rows.push(ledgerRow(e, e.customer_id, false));
        }
        if (!salesSide) {
          for (const e of vendorSide) {
            if (counts(e.vendor_id) && e.entry_type === 'credit' && e.source_type !== 'business_transaction') {
              rows.push(ledgerRow(e, e.vendor_id, false));
            }
          }
        }
      }
      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  }, [
    transactions,
    kindBills,
    partyRow,
    ledgerEntries,
    vendorEntries,
    partyCustomerEntries,
    partyVendorEntries,
    nameById,
    categoryById,
    categories,
    expenseLedgerIds,
    staffLedgerIds,
    saleLedgerIds,
    purchaseLedgerIds,
    hrefFor,
    basePath,
    kind,
    partyId,
  ]);

  // The rest of what is on a person's ledger - money received from or paid to them, and what they
  // owe or are owed outside a bill - listed under their bills so the page shows all of it. The
  // entry a Sale / Purchase posts is left out: it is the bill itself, listed above.
  const partyLedgerRows = useMemo((): Entry[] => {
    if (!partyId) return [];
    const rows: Entry[] = [];
    const nav: NavTarget = { kind: 'party', partyId };
    // What is already one of the report's own rows above (see `entries`) is not repeated here. What
    // is left is what has no place there: for Sales what they owe and what was paid out to them, for
    // Purchase what was received from them and what was bought on credit, for an Expense ledger what
    // they owe and what was bought on credit.
    for (const e of partyCustomerEntries ?? []) {
      if (e.source_type === 'business_transaction') continue;
      const manual = e.source === 'manual';
      const inReport =
        kind === 'expense' ? manual : kind === 'sale' ? e.entry_type === 'credit' : e.entry_type === 'debit' && manual;
      if (inReport) continue;
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
      // A payment out (credit) is one of Expense's and Purchase's own rows.
      if (e.entry_type === 'credit' && kind !== 'sale') continue;
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
  }, [partyId, kind, partyCustomerEntries, partyVendorEntries]);

  // The plain reports are this year's; a person's own report is all of their bills - one
  // person has few, and an old one should not look like there is nothing.
  const yearEntries = useMemo(
    () => (partyId ? entries : entries.filter((e) => new Date(e.date).getFullYear() === year)),
    [entries, year, partyId]
  );

  // The Expense Report is laid out by category - Fuel, Bike Repair, Salary Advance ... - each with
  // what it adds up to, biggest first, and the individual ledgers / categories under it (Fuel
  // Aviator, Fuel Manish ...; the category pill on every row says which). Categories come from the
  // words the names start with, so there is nothing to set up. Every expense category and every
  // ledger typed Expense has its place, spent on this year or not, so each is there to pick from the
  // dropdown.
  //
  // The Sales and Purchase reports are laid out the same way, by who it was with: a heading per
  // customer / vendor (exactly as named) with what it adds up to, and a dropdown to pick one. Only
  // people with something recorded this year are listed. The other reports stay by month.
  const grouped = useMemo(() => {
    if (partyId || (kind !== 'expense' && kind !== 'sale' && kind !== 'purchase')) return null;
    const UNFILED = kind === 'expense' ? 'Uncategorized' : 'No party';
    const names: string[] = [];
    const known = new Set<string>();
    const addName = (name: string | null | undefined) => {
      const clean = (name ?? '').trim();
      if (clean && !known.has(nameKey(clean))) {
        known.add(nameKey(clean));
        names.push(clean);
      }
    };
    for (const e of yearEntries) addName(e.category ?? UNFILED);
    if (kind === 'expense') {
      for (const c of categories ?? []) addName(c.name);
      // Only Expense ledgers are categories; an employee is a person and never is one.
      for (const c of customers ?? []) if (expenseLedgerIds.has(c.id)) addName(c.name);
    }

    // Expense names are merged by the words they start with; a customer or vendor is its own heading.
    const labelOf =
      kind === 'expense' ? groupExpenseNames(names) : new Map(names.map((n) => [nameKey(n), n.trim()] as const));
    const groups = new Map<string, { key: string; label: string; total: number; rows: Entry[] }>();
    const groupOf = (name: string) => {
      const label = labelOf.get(nameKey(name)) ?? name.trim();
      let group = groups.get(nameKey(label));
      if (!group) {
        group = { key: nameKey(label), label, total: 0, rows: [] };
        groups.set(group.key, group);
      }
      return group;
    };
    for (const name of names) groupOf(name);
    for (const e of yearEntries) {
      const group = groupOf(e.category ?? UNFILED);
      // A payment that settles a bill is listed under its heading but is not added to its figure.
      if (!e.payment) group.total += e.amount;
      group.rows.push(e);
    }

    const ordered = [...groups.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
    // Each row's section heading, by the row's id; rows within a section stay newest first.
    const headingOf = new Map<string, string>();
    for (const g of ordered) {
      const heading = `${g.label}  ·  NPR ${money(g.total)}  ·  ${g.rows.length} ${g.rows.length === 1 ? 'entry' : 'entries'}`;
      for (const e of g.rows) headingOf.set(e.id, heading);
    }
    return { groups: ordered, rows: ordered.flatMap((g) => g.rows), headingOf };
  }, [kind, partyId, yearEntries, categories, customers, expenseLedgerIds]);

  // The one category (Expense) or customer / vendor (Sales / Purchase) picked from the dropdown
  // ('' = all of them), so a long report can be narrowed to Fuel or to one customer without
  // scrolling to it. Picking narrows the table and the figures above it together.
  const [categoryPick, setCategoryPick] = useState('');
  const picked = grouped?.groups.find((g) => g.key === categoryPick) ?? null;
  const shownEntries = picked ? picked.rows : yearEntries;
  const pickWord = kind === 'expense' ? { one: 'Category', all: 'All categories' } : kind === 'sale' ? { one: 'Customer', all: 'All customers' } : { one: 'Vendor', all: 'All vendors' };
  const categoryOptions = useMemo(
    () => [
      { key: '', label: `${pickWord.all} · ${money(yearEntries.reduce((sum, e) => (e.payment ? sum : sum + e.amount), 0))}` },
      ...(grouped?.groups ?? []).map((g) => ({ key: g.key, label: `${g.label} · ${money(g.total)}` })),
    ],
    [grouped, yearEntries, pickWord.all]
  );

  const stats = useMemo(() => {
    const now = new Date();
    let total = 0;
    let thisMonth = 0;
    let largest = 0;
    // Money received / paid on a Sales / Purchase ledger: its own figure, apart from what was billed.
    let payments = 0;
    let paymentCount = 0;
    for (const e of shownEntries) {
      if (e.payment) {
        payments += e.amount;
        paymentCount += 1;
        continue;
      }
      total += e.amount;
      largest = Math.max(largest, e.amount);
      const d = new Date(e.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonth += e.amount;
    }
    return { total, thisMonth, largest, payments, paymentCount };
  }, [shownEntries]);

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
      (e.href ??
        (e.nav.kind === 'transactions' ? `${basePath}/transactions?type=${e.nav.type}` : `${basePath}/customer/${e.nav.partyId}`)) as never
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
        <BookStat label="Entries" value={String(shownEntries.length)} color="#374151" />
        <BookStat label="Largest" value={`NPR ${money(stats.largest)}`} color="#374151" />
        {stats.paymentCount > 0 && (
          <BookStat label={kind === 'sale' ? 'Received on bills' : 'Paid on bills'} value={`NPR ${money(stats.payments)}`} color={meta.color} />
        )}
      </BookStats>

      {grouped && grouped.groups.length > 0 && (
        // Raised above the table that follows: every View is its own stacking layer on the web, so
        // the dropdown's list can only draw over the table if the row holding it is above it too.
        <View className="flex-row flex-wrap items-center" style={{ gap: 8, zIndex: 50 }}>
          <InlineSelect label={pickWord.one} options={categoryOptions} value={picked ? categoryPick : ''} onChange={setCategoryPick} searchable />
          {picked && (
            <Pressable onPress={() => setCategoryPick('')} accessibilityRole="button" accessibilityLabel="Show every category" hitSlop={6}>
              <Text className="text-[12.5px] font-semibold text-blue-700">Show all</Text>
            </Pressable>
          )}
        </View>
      )}

      {shownEntries.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-10">
          <Ionicons name="cash-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">
            {partyId
              ? `No ${kind} bills recorded for ${partyRow?.name ?? 'this person'}.`
              : picked
                ? `Nothing recorded under ${picked.label} this year.`
                : 'Nothing here yet.'}
          </Text>
        </View>
      ) : (
        <BookTable
          columns={columns}
          rows={grouped ? (picked ? picked.rows : grouped.rows) : yearEntries}
          rowKey={(e) => e.id}
          onRowPress={open}
          groupOf={(e) => (grouped ? grouped.headingOf.get(e.id) ?? '' : bsMonthGroup(e.date))}
          footer={{
            label: `${shownEntries.length} ${shownEntries.length === 1 ? 'entry' : 'entries'} · Total`,
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
          ? kind === 'expense'
            ? 'Tap a bill to open it; tap a payment to open this ledger, where it can be edited. Money paid to this ledger counts as an expense, and money received back is taken off. The balance above counts every entry of both ledgers.'
            : `Tap a bill to open it; tap a ${kind === 'sale' ? 'receipt' : 'payment'} to open their ledger, where it can be edited. What was ${kind === 'sale' ? 'received' : 'paid'} is listed with the bills. With bills recorded it settles them and is not added again (a bill and its payment would count twice); with none, it is the ${kind === 'sale' ? 'sale' : 'purchase'} and counts. The balance above counts every entry of both ledgers.`
          : kind === 'received'
            ? 'Tap an entry to open it. Only money actually collected counts here - a sale bill on credit shows up once the customer pays.'
            : kind === 'paid'
              ? 'Tap an entry to open it. Only money that actually left counts here - a purchase bill on credit shows up once you pay the vendor.'
              : kind === 'expense'
                ? "Tap an entry to open it. Grouped by category - names that start with the same words (Fuel Aviator, Fuel Manish) sit under one heading; use Category above to look at just one. Counts every expense bill, and money paid to a ledger typed Expense or Employee (listed under that ledger's name). This year only."
                : `Tap an entry to open it. Grouped by ${kind === 'sale' ? 'customer' : 'vendor'}; use ${pickWord.one} above to look at one. Every ${kind} bill counts here, whether or not the money has moved yet. What was ${kind === 'sale' ? 'received' : 'paid'} on any ledger is listed too: for someone with ${kind} bills it settles them and is not added again; for someone with none it is the ${kind} and counts. This year only.`}
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
