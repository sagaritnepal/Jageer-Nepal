// lib/utils/ticket.ts

/** A job's ticket number as people say and write it: "#0042". The number
 * itself is the database's (migration 0086) - a plain serial given once, when
 * the job is created. Null for a job without one (before that migration has
 * been run), so a screen shows nothing rather than "#0000". */
export function ticketLabel(no: number | string | null | undefined): string | null {
  if (no == null || no === '') return null;
  const n = Math.trunc(Number(no));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `#${String(n).padStart(4, '0')}`;
}
