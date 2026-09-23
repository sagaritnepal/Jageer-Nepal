// lib/utils/duration.ts
// Jobs can run from a few minutes to several days, so the label only ever
// shows the two most significant units (e.g. "1d 4h", "3h 12m", "8m") -
// enough precision to be useful without cluttering the UI with seconds.
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

export function formatDurationBetween(startIso: string, endIso: string | Date = new Date()): string {
  const end = typeof endIso === 'string' ? new Date(endIso) : endIso;
  return formatDuration(end.getTime() - new Date(startIso).getTime());
}

// A specific moment (job accepted / completed), spelled out in full so it
// reads as a point in time rather than being mistaken for a duration.
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
