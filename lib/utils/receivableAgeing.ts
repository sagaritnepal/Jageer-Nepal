// lib/utils/receivableAgeing.ts
//
// Who owes whom, and how long what is owed to you has been waiting. One calculation for the Company
// dashboard (its Receivable ageing card) and the Ageing Report, so the two always show the same figures.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The age groups, oldest last: a balance is as old as the day its party last became indebted. */
export const AGEING_BUCKETS = [
  { label: '0–30 days', color: '#0F766E', bg: '#F0FDFA' },
  { label: '31–60 days', color: '#B45309', bg: '#FFFBEB' },
  { label: '60+ days', color: '#B91C1C', bg: '#FEF2F2' },
] as const;

/** 0 = up to 30 days, 1 = 31-60, 2 = more. */
export function bucketOf(days: number): 0 | 1 | 2 {
  return days <= 30 ? 0 : days <= 60 ? 1 : 2;
}

interface LedgerEntryLike {
  entry_type: string;
  amount: number;
  entry_date?: string | null;
  created_at: string;
}

/** A party that owes you money (a positive balance), with how long it has been waiting. */
export interface OwingParty {
  id: string;
  balance: number;
  /** 'YYYY-MM-DD' of the last time they became indebted; null when they never were (an advance, say). */
  lastBilledDay: string | null;
  days: number;
  bucket: 0 | 1 | 2;
}

export function computeOwed(
  customerEntries: (LedgerEntryLike & { customer_id: string })[],
  vendorEntries: (LedgerEntryLike & { vendor_id: string })[],
  now = Date.now()
) {
  const net = new Map<string, number>();
  customerEntries.forEach((e) => net.set(e.customer_id, (net.get(e.customer_id) ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount)));
  vendorEntries.forEach((e) => net.set(e.vendor_id, (net.get(e.vendor_id) ?? 0) - (e.entry_type === 'debit' ? e.amount : -e.amount)));
  // When each customer last became indebted, to age what they owe.
  const lastDebit = new Map<string, { time: number; day: string }>();
  customerEntries.forEach((e) => {
    if (e.entry_type !== 'debit') return;
    const day = (e.entry_date ?? e.created_at).slice(0, 10);
    const time = new Date(day).getTime();
    if (time > (lastDebit.get(e.customer_id)?.time ?? 0)) lastDebit.set(e.customer_id, { time, day });
  });
  let receivable = 0;
  let payable = 0;
  let debtors = 0;
  const ageing = [0, 0, 0];
  const owing: OwingParty[] = [];
  net.forEach((v, id) => {
    if (v > 0.5) {
      receivable += v;
      debtors += 1;
      const last = lastDebit.get(id);
      const days = last ? Math.max(0, (now - last.time) / DAY_MS) : 0;
      const bucket = bucketOf(days);
      ageing[bucket] += v;
      owing.push({ id, balance: v, lastBilledDay: last?.day ?? null, days, bucket });
    } else if (v < -0.5) payable += -v;
  });
  return { receivable, payable, debtors, ageing, owing };
}

/** What was owed to you, and what you owed, at the end of each of the last `months` months. `monthOf` says which
 * month (0 = the oldest shown) a date falls in: below 0 for earlier ones, and anything past the last is counted in
 * the last, so the final point is the balance right now (the same figures `computeOwed` gives). */
export function owedByMonth(
  customerEntries: (LedgerEntryLike & { customer_id: string })[],
  vendorEntries: (LedgerEntryLike & { vendor_id: string })[],
  monthOf: (date: string) => number,
  months: number
) {
  // for each party, what changed in each month - slot 0 holds everything before the first month shown
  const steps = new Map<string, number[]>();
  const add = (id: string, date: string, delta: number) => {
    const slot = Math.max(0, Math.min(months - 1, monthOf(date)) + 1);
    const list = steps.get(id) ?? new Array<number>(months + 1).fill(0);
    list[slot] += delta;
    steps.set(id, list);
  };
  customerEntries.forEach((e) => add(e.customer_id, e.entry_date ?? e.created_at, e.entry_type === 'debit' ? e.amount : -e.amount));
  vendorEntries.forEach((e) => add(e.vendor_id, e.entry_date ?? e.created_at, e.entry_type === 'debit' ? -e.amount : e.amount));
  const receivable = new Array<number>(months).fill(0);
  const payable = new Array<number>(months).fill(0);
  steps.forEach((list) => {
    let running = list[0];
    for (let i = 0; i < months; i++) {
      running += list[i + 1];
      if (running > 0.5) receivable[i] += running;
      else if (running < -0.5) payable[i] -= running;
    }
  });
  return { receivable, payable };
}
