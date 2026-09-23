// lib/utils/scheduledTime.ts
// service_requests.scheduled_date/scheduled_time hold the appointment slot
// the customer/reseller picked when the job was booked - e.g. "2026-09-15" /
// "15:00" - not when the technician actually worked on it. Rendered as
// those raw strings ("2026-09-15 - 15:00") this reads as ambiguous or even
// like a duration; spelling it out as a weekday/month name and 12-hour time
// makes clear it's a single scheduled moment, not a span.
function parseSlot(date: string, time: string | null): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [h, min] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0);
}

export function formatScheduledWhen(date: string | null, time: string | null): string | null {
  if (!date && !time) return null;
  if (!date) return `Date TBD · ${time}`;

  const parsed = parseSlot(date, time);
  const dateLabel = parsed
    ? parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : date;

  if (!time) return `${dateLabel} · Time TBD`;
  const timeLabel = parsed ? parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : time;
  return `${dateLabel} at ${timeLabel}`;
}
