// lib/utils/fetchAllRows.ts

/** Supabase's API hands back at most 1000 rows per request (the project's
 * "max rows" setting) and silently drops the rest - no error, just a short
 * list. Anything that adds rows up (a ledger balance) has to read them all
 * or its total is quietly wrong. */
export const PAGE_SIZE = 1000;

type Page<R> = {
  data: R[] | null;
  error: { message: string } | null;
  /** Total matching rows, when the request asked for `count: 'exact'`. */
  count?: number | null;
};

/** Reads page after page (rows `from`..`to`, inclusive) until every row is in.
 * Each page advances by what the server really returned, so it stays correct
 * even if the server's row cap is lower than PAGE_SIZE. */
export async function fetchAllRows<R>(fetchPage: (from: number, to: number) => PromiseLike<Page<R>>): Promise<R[]> {
  const rows: R[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (count != null) total = count;
    if (page.length === 0) break;
    if (total != null ? rows.length >= total : page.length < PAGE_SIZE) break;
  }
  return rows;
}
