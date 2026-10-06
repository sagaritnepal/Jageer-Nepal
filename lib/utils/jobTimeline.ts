// lib/utils/jobTimeline.ts
// A job's life in five steps - posted, pending, assigned, working, completed -
// with when each happened and how long it took. Pure functions over a request
// and its job card, so the Work Hub rows and any other screen read it the same.
import { formatDuration } from './duration';
import { STUCK_OFFER_MS } from './teamStatus';
import type { ServiceRequest } from '../../types/database.types';

/** The two moments a job card keeps: when the technician started and finished. */
export type JobTimes = { started_at: string | null; completed_at: string | null };

export type StageKey = 'posted' | 'pending' | 'assigned' | 'wip' | 'done';

export type JobStage = {
  key: StageKey;
  /** "Completed" - or "Cancelled" for a job that was called off. */
  label: string;
  /** When it happened, short ("Sep 27, 11:30"); null when it has not, or is not known. */
  at: string | null;
  /** How long, in words ("3h 20m so far", "accepted in 15m"); null when there is nothing to say. */
  span: string | null;
  /** done: finished; now: the stage the job is in; todo: not reached. */
  state: 'done' | 'now' | 'todo';
  /** Worth a second look: an offer nobody has accepted for a while. */
  warn?: boolean;
};

const ms = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** "Sep 27, 11:30" - 24-hour, to match the times the job list already shows. */
export function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function jobStages(request: ServiceRequest, times: JobTimes | undefined, now: number): JobStage[] {
  const posted = new Date(request.created_at).getTime();
  const assigned = ms(request.assigned_at);
  const started = ms(times?.started_at);
  const completed = ms(times?.completed_at);
  const cancelled = request.status === 'cancelled';
  const resolved = request.status === 'resolved';
  const finished = cancelled || resolved;
  // When the job stopped being worked on: completed, or called off.
  const ended = resolved ? completed : cancelled ? ms(request.updated_at) : null;

  // Pending: from being posted until somebody was put on it (or it ended).
  const pendingUntil = assigned ?? started ?? ended;
  const pending: JobStage =
    pendingUntil != null
      ? { key: 'pending', label: 'Pending', at: null, span: formatDuration(pendingUntil - posted), state: 'done' }
      : finished
        ? { key: 'pending', label: 'Pending', at: null, span: null, state: 'done' }
        : { key: 'pending', label: 'Pending', at: null, span: `${formatDuration(now - posted)} so far`, state: 'now' };

  // Assigned: when it was offered, and how long the technician took to accept.
  const hasTechnician = !!request.technician_id;
  const offerOpen = request.status === 'assigned' && started == null;
  const waited = assigned != null ? now - assigned : null;
  const assignedStage: JobStage = !hasTechnician && assigned == null
    ? { key: 'assigned', label: 'Assigned', at: null, span: null, state: 'todo' }
    : {
        key: 'assigned',
        label: 'Assigned',
        at: request.assigned_at ? stamp(request.assigned_at) : null,
        span:
          started != null && assigned != null
            ? `accepted in ${formatDuration(started - assigned)}`
            : offerOpen && waited != null
              ? `waiting ${formatDuration(waited)}`
              : null,
        state: offerOpen ? 'now' : 'done',
        warn: offerOpen && waited != null && waited >= STUCK_OFFER_MS,
      };

  // Working: from the technician starting until it was finished (or still going).
  const working = request.status === 'in_progress';
  const wip: JobStage =
    started != null
      ? {
          key: 'wip',
          label: 'Working',
          at: stamp(times!.started_at!),
          span: working ? `${formatDuration(now - started)} so far` : ended != null ? formatDuration(ended - started) : null,
          state: working ? 'now' : 'done',
        }
      : { key: 'wip', label: 'Working', at: null, span: null, state: 'todo' };

  // Completed / Cancelled: the end, and how long the whole thing took.
  const done: JobStage = finished
    ? {
        key: 'done',
        label: cancelled ? 'Cancelled' : 'Completed',
        at: cancelled ? stamp(request.updated_at) : times?.completed_at ? stamp(times.completed_at) : null,
        span: ended != null ? `${formatDuration(ended - posted)} in all` : null,
        state: 'done',
      }
    : { key: 'done', label: 'Completed', at: null, span: null, state: 'todo' };

  const postedStage: JobStage = {
    key: 'posted',
    label: 'Posted',
    at: stamp(request.created_at),
    span: `${formatDuration(now - posted)} ago`,
    state: 'done',
  };

  return [postedStage, pending, assignedStage, wip, done];
}
