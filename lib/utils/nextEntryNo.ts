// lib/utils/nextEntryNo.ts
import { supabase } from '../supabase';
import { fetchAllRows } from './fetchAllRows';
import type { LedgerEntryType } from '../../types/database.types';

/**
 * The next receipt / payment number (001, 002, ...) for an entry typed in by hand: one past
 * the highest number already used in that ledger and direction - the same working-out the
 * Payment In / Payment Out screens use for the number they suggest, so a payment gets the
 * next number whichever screen it is recorded on. Entries saved before numbering existed
 * have none, so when no number parses it counts the entries instead, keeping it moving
 * forward rather than starting again at 001 every time.
 *
 * Received from a customer = customer ledger, credit. Paid to a vendor = vendor ledger, credit.
 */
export async function nextEntryNo(
  table: 'customer_ledger_entries' | 'vendor_ledger_entries',
  ownerId: string,
  entryType: LedgerEntryType
): Promise<string> {
  const rows = await fetchAllRows<{ receipt_no: string | null }>(
    (from, to) =>
      (supabase.from(table) as any)
        .select('receipt_no', { count: 'exact' })
        .eq('owner_id', ownerId)
        .eq('entry_type', entryType)
        .eq('source', 'manual')
        .order('id')
        .range(from, to)
  );
  const numbers = rows.map((r) => Number((r.receipt_no ?? '').replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  return String((numbers.length ? Math.max(...numbers) : rows.length) + 1).padStart(3, '0');
}
