// lib/utils/jobTimeline.ts
// A job's journey: four moments (posted, assigned, started, completed) joined
// by three stretches of time (pending, waiting to accept, work in progress).
// The moments carry WHEN, the stretches carry HOW LONG - keeping the two apart
// is what makes it readable. Pure functions over a request and its job card,
// so every screen reads it the same way.
import { formatDuration } from './duration';
import { STUCK_OFFER_MS } from './teamStatus';
import type { ServiceRequest } from '../../types/database.types';

/** The two moments a job card keeps: when the technician started and finished. */
export type JobTimes = { started_at: string | null; completed_at: string | null };

export type NodeKey = 'posted' | 'assigned' | 'started' | 'done';

export type JourneyNode = {
  key: NodeKey;
  /** "Completed" - or "Cancelled" for a job that was called off. */
  label: string;
  reached: boolean;
  /** When it happened ("Sep 27, 15:56"); null when it has not, or the time was not saved. */
  at: string | null;
  /** Posted: "9d 2h ago". The last moment: "10h 0m total" from posting to the end. */
  note: string | null;
  kind: 'plain' | 'completed' | 'cancelled';
};

export type LegKey = 'pending' | 'accept' | 'wip';

export type JourneyLeg = {
  key: LegKey;
  label: string;
  /** How long ("4h 20m", "9d 2h so far"); null when there is nothing to say. */
  value: string | null;
  /** done: over; now: this is where the job is; todo: not reached. */
  state: 'done' | 'now' | 'todo';
  /** An offer nobody has accepted for a while - worth a look. */
  warn?: boolean;
};

/** `legs[i]` is the stretch between `nodes[i]` and `nodes[i + 1]`. */
export type Journey = { nodes: JourneyNode[]; legs: JourneyLeg[] };

const ms = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** "Sep 27, 15:56" - 24-hour, to match the times the job list already shows. */
export function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function jobJourney(request: ServiceRequest, times: JobTimes | undefined, now: number): Journey {
  const posted = new Date(request.created_at).getTime();
  const assigned = ms(request.assigned_at);
  const started = ms(times?.started_at);
  const completed = ms(times?.completed_at);
  const cancelled = request.status === 'cancelled';
  const resolved = request.status === 'resolved';
  const finished = cancelled || resolved;
  // When the job stopped: completed, or called off.
  const ended = resolved ? completed : cancelled ? ms(request.updated_at) : null;

  const nodes: JourneyNode[] = [
    {
      key: 'posted',
      label: 'Posted',
      reached: true,
      at: stamp(request.created_at),
      note: `${formatDuration(now - posted)} ago`,
      kind: 'plain',
    },
    {
      key: 'assigned',
      label: 'Assigned',
      reached: assigned != null || started != null || !!request.technician_id,
      at: request.assigned_at ? stamp(request.assigned_at) : null,
      note: null,
      kind: 'plain',
    },
    {
      key: 'started',
      label: 'Started',
      reached: started != null,
      at: times?.started_at ? stamp(times.started_at) : null,
      note: null,
      kind: 'plain',
    },
    {
      key: 'done',
      label: cancelled ? 'Cancelled' : 'Completed',
      reached: finished,
      at: cancelled ? stamp(request.updated_at) : times?.completed_at ? stamp(times.completed_at) : null,
      note: ended != null ? `${formatDuration(ended - posted)} total` : null,
      kind: cancelled ? 'cancelled' : resolved ? 'completed' : 'plain',
    },
  ];

  // Pending: from being posted until somebody was put on it (or it ended).
  const until = assigned ?? started ?? ended;
  const pending: JourneyLeg =
    until != null
      ? { key: 'pending', label: 'Pending', value: formatDuration(until - posted), state: 'done' }
      : finished
        ? { key: 'pending', label: 'Pending', value: null, state: 'done' }
        : { key: 'pending', label: 'Pending', value: `${formatDuration(now - posted)} so far`, state: 'now' };

  // From the offer to the technician starting: how long they took to accept.
  const offerOpen = request.status === 'assigned' && started == null;
  const waited = assigned != null ? now - assigned : null;
  const accept: JourneyLeg = offerOpen
    ? {
        key: 'accept',
        label: 'Waiting to accept',
        value: waited != null ? formatDuration(waited) : null,
        state: 'now',
        warn: waited != null && waited >= STUCK_OFFER_MS,
      }
    : started != null
      ? { key: 'accept', label: 'Accepted in', value: assigned != null ? formatDuration(started - assigned) : null, state: 'done' }
      : { key: 'accept', label: 'Accepted in', value: null, state: 'todo' };

  // Work in progress: from starting until it was finished (or still going).
  const working = request.status === 'in_progress';
  const wip: JourneyLeg =
    started != null
      ? working
        ? { key: 'wip', label: 'WIP', value: `${formatDuration(now - started)} so far`, state: 'now' }
        : { key: 'wip', label: 'WIP', value: ended != null ? formatDuration(ended - started) : null, state: 'done' }
      : { key: 'wip', label: 'WIP', value: null, state: 'todo' };

  return { nodes, legs: [pending, accept, wip] };
}
