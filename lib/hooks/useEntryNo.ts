// lib/hooks/useEntryNo.ts
import { useEffect, useState } from 'react';
import { nextEntryNo } from '../utils/nextEntryNo';
import type { LedgerEntryType } from '../../types/database.types';

/**
 * The receipt / payment number box of an entry form. A new entry (`auto`) opens with the next
 * number already in it - and finds the next one again if the entry's kind changes - until the
 * person types in the box, after which what they typed is left alone. An entry that already
 * exists keeps its own number (`existing`), which can be fixed by typing over it.
 */
export function useEntryNo({
  table,
  ownerId,
  entryType,
  auto,
  existing,
}: {
  table: 'customer_ledger_entries' | 'vendor_ledger_entries';
  ownerId: string;
  entryType: LedgerEntryType;
  auto: boolean;
  existing?: string | null;
}) {
  const [receiptNo, setReceiptNo] = useState(existing ?? '');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    if (!auto) {
      setReceiptNo(existing ?? '');
      return;
    }
    let live = true;
    nextEntryNo(table, ownerId, entryType)
      .then((no) => {
        if (live) setReceiptNo(no);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [touched, auto, table, ownerId, entryType, existing]);

  return {
    receiptNo,
    onChange: (value: string) => {
      setTouched(true);
      setReceiptNo(value);
    },
  };
}
