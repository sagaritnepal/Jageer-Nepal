// lib/utils/dbErrors.ts
import { getErrorMessage } from './alert';

/** What to tell the user when removing a row failed. The database refuses a
 * delete while other rows still point at it and reports it as error 23503
 * ("violates foreign key constraint ... on table X"); say that in plain words,
 * with the table that is in the way, instead of the raw SQL text. */
export function deleteErrorMessage(err: unknown, what = 'this'): string {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === '23503' || /violates foreign key constraint/i.test(e?.message ?? '')) {
    // "update or delete on table "customers" violates foreign key constraint "x" on table "service_requests"":
    // the table in the way is the one named after the constraint, not the first one.
    const table = e?.message?.match(/constraint "[^"]*" on table "([^"]+)"/)?.[1];
    return `${what[0].toUpperCase()}${what.slice(1)} is still linked to ${
      table ? `records in "${table}"` : 'other records'
    }, so the database refused to remove it. Run migration 0085_delete_customer_links.sql once in the Supabase SQL Editor to allow it.`;
  }
  return getErrorMessage(err, 'Please try again.');
}
