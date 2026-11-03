// lib/components/requests/WorkHubPanel.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { JobTimeline } from '../JobTimeline';
import { TicketChip } from '../TicketChip';
import { ticketLabel } from '../../utils/ticket';
import { jobJourney, jobStages, type JobTimes } from '../../utils/jobTimeline';
import { useAuthStore } from '../../hooks/useAuth';
import { subscribeToTable, useSupabaseQuery, useSupabaseUpdate } from '../../hooks/useSupabase';
import { useMyEmployees } from '../../hooks/useTechnicianEmployment';
import { assignTechnician, showJobSentAlert } from '../../utils/assignTechnician';
import { canCancelWork, useCancelWork } from '../../hooks/useCancelWork';
import { canDeleteJob, useDeleteJob } from '../../hooks/useDeleteJob';
import { useBackStep } from '../../hooks/useBackStep';
import { editJobHref, newJobHref } from '../../utils/newJobHref';
import { canMarkJobDone, useMarkJobDone } from '../../hooks/useMarkJobDone';
import { PersonAvatar } from '../PersonAvatar';
import { CategoryBadge } from '../CategoryBadge';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { formatScheduledWhen } from '../../utils/scheduledTime';
import { numericDateLabel, toAdLabel, toBsHistoryLabel, toBsLabel } from '../../utils/nepaliDate';
import { formatDuration, formatDurationBetween } from '../../utils/duration';
import { entryDay } from '../../utils/ledgerStatement';
import { useCalendarMode } from '../../hooks/useCalendarMode';
import { DateField } from '../DateTimeFields';
import {
  EditableAmount,
  FULL_TABLE_WIDTH,
  JobProgressBars,
  JobTableHeader,
  JobTableScroll,
  ROW_BUTTON_HEIGHT,
  ROW_PAD_X,
  ROW_PAD_Y,
  TIER_GAP,
  TIER_WIDTH,
  columnsOf,
  tierFor,
  widthOf,
  type ColKey,
  type Tier,
} from './JobTable';
import { exportWorkPdf, exportWorkXlsx, type WorkRecordRow } from '../../utils/exportWorkRecord';
import type { Profile, ServiceRequest } from '../../../types/database.types';

const BLUE = '#2563EB';

/** Jobs still in play - anything finished, paid or cancelled has no place
 * on a board about who is doing what today. */
const LIVE_STATUSES: ServiceRequest['status'][] = ['pending', 'approved', 'assigned', 'in_progress'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plain words for the saved record - "in_progress" is the database's
 * word, not one a reader wants in a spreadsheet. */
const STATUS_WORDS: Record<ServiceRequest['status'], string> = {
  pending: 'Not started',
  quoted: 'Quote sent',
  approved: 'Approved',
  assigned: 'Waiting to accept',
  in_progress: 'Working on it',
  resolved: 'Finished',
  cancelled: 'Cancelled',
};

/** When the job was meant to happen: its appointment if it has one, else
 * when it was raised. */
function dueAt(request: ServiceRequest): number {
  if (request.scheduled_date) {
    const time = request.scheduled_time?.slice(0, 5) ?? '23:59';
    const parsed = new Date(`${request.scheduled_date}T${time}`).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return new Date(request.created_at).getTime();
}

/** Still open a day after it should have been done - the jobs worth
 * chasing, which is what this page is for. */
function isOverdue(request: ServiceRequest): boolean {
  return Date.now() - dueAt(request) > DAY_MS;
}

/** Your own walk-in jobs can be edited in the Add work form; an app customer's details are theirs. */
function canEditJob(request: ServiceRequest): boolean {
  return request.origin === 'reseller' && canCancelWork(request);
}

function money(n: number | null | undefined): string {
  return n == null ? '—' : `NPR ${Math.round(Number(n)).toLocaleString()}`;
}

/** When each job's technician started and finished it, by job - the two
 * moments the timeline needs that the request itself does not carry. Asked for
 * in chunks so a reseller with hundreds of jobs does not build a huge address. */
function useJobTimes(requestIds: string[]) {
  const { data } = useQuery({
    queryKey: ['job-card-times', requestIds],
    queryFn: async () => {
      const byRequest = new Map<string, JobTimes & { created_at: string }>();
      for (let i = 0; i < requestIds.length; i += 100) {
        const { data: rows, error } = await (supabase.from('job_cards') as any)
          .select('service_request_id, started_at, completed_at, created_at')
          .in('service_request_id', requestIds.slice(i, i + 100));
        if (error) throw error;
        for (const row of (rows ?? []) as (JobTimes & { service_request_id: string; created_at: string })[]) {
          // A job handed on can have a card per technician - the latest is the live one.
          const seen = byRequest.get(row.service_request_id);
          if (!seen || row.created_at > seen.created_at) byRequest.set(row.service_request_id, row);
        }
      }
      return byRequest as Map<string, JobTimes>;
    },
    enabled: requestIds.length > 0,
    refetchInterval: 30_000,
  });
  return data;
}

/** The current time, ticking each minute, so "3h 20m so far" keeps counting. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function when(request: ServiceRequest): string {
  const date = request.scheduled_date ?? 'No date';
  return request.scheduled_time ? `${date} · ${request.scheduled_time}` : date;
}

/** Where the job stands, in the words the reseller would use. */
function statusChip(request: ServiceRequest): { label: string; color: string; bg: string } {
  if (request.status === 'cancelled') return { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6' };
  if (request.status === 'resolved') {
    return request.payment_status === 'paid'
      ? { label: 'Done & paid', color: '#047857', bg: '#ECFDF5' }
      : { label: 'Completed', color: '#16A34A', bg: '#F0FDF4' };
  }
  if (request.status === 'in_progress') return { label: 'Working on it', color: '#1D4ED8', bg: '#EFF6FF' };
  if (request.status === 'assigned') return { label: 'Waiting for them to accept', color: '#4B5563', bg: '#F3F4F6' };
  if (request.open_to_team) return { label: 'Waiting to be picked up', color: '#047857', bg: '#ECFDF5' };
  return { label: 'Not started', color: '#6B7280', bg: '#F3F4F6' };
}

/** "CCTV & Surveillance - Repair" reads as a category over a job name; a name without the dash is all title. */
function splitIssue(issue: string): { eyebrow: string | null; title: string } {
  const at = issue.indexOf(' - ');
  if (at <= 0) return { eyebrow: null, title: issue };
  return { eyebrow: issue.slice(0, at), title: issue.slice(at + 3) };
}

/** Whole days (or hours, under a day) past the time the job was meant to be done. */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}

function overdueBy(request: ServiceRequest): string {
  const late = Date.now() - dueAt(request);
  const days = Math.floor(late / DAY_MS);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(late / (60 * 60 * 1000)));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function OverdueChip() {
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEF2F2' }}>
      <Text className="text-[10.5px] font-bold" style={{ color: '#B91C1C' }}>
        Overdue
      </Text>
    </View>
  );
}

/** `compact` is the narrow card in an employee's day: no picture or address, the job's name on two lines. */
function JobCard({ request, footer, compact }: { request: ServiceRequest; footer?: React.ReactNode; compact?: boolean }) {
  const chip = statusChip(request);
  return (
    <View className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-2' : 'p-3'}`}>
      <Pressable
        onPress={() => router.push(`/(reseller)/request/${request.id}` as any)}
        className={compact ? '' : 'flex-row items-start gap-2.5'}
      >
        {!compact && <CategoryBadge category={request.issue_type} size={30} />}
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TicketChip no={request.ticket_no} />
            {!compact && (
              <Text className="text-[13.5px] font-bold text-gray-900" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
                {request.issue_type}
              </Text>
            )}
          </View>
          {compact && (
            <Text className="mt-1 text-[12px] font-bold text-gray-900" numberOfLines={2}>
              {request.issue_type}
            </Text>
          )}
          <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={1}>
            {compact ? (request.customer_name ?? 'Customer') : `${request.customer_name ?? 'Customer'} · ${when(request)}`}
          </Text>
          {!compact && (
            <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={1}>
              {request.location_data?.address ?? 'No address'}
            </Text>
          )}
          <View className="mt-1.5 flex-row flex-wrap items-center" style={{ gap: 6 }}>
            <View
              className={compact ? 'rounded-lg px-2 py-0.5' : 'rounded-full px-2 py-0.5'}
              style={{ backgroundColor: chip.bg, ...(compact ? { maxWidth: '100%' } : null) }}
            >
              <Text className="text-[10.5px] font-bold" style={{ color: chip.color }} numberOfLines={compact ? 2 : undefined}>
                {chip.label}
              </Text>
            </View>
            {isOverdue(request) && <OverdueChip />}
            <Text className="text-[11.5px] font-semibold text-gray-700">{money(request.quoted_price)}</Text>
          </View>
        </View>
      </Pressable>
      {footer}
    </View>
  );
}

/** One stretch of today a technician had a job under way, in minutes from midnight (0 - 1440). */
type DaySpan = { id: string; request: ServiceRequest; ticket: string | null; title: string; from: number; to: number; running: boolean };

/** The stretches of a day a technician spent on jobs: from when they started it (the job card) to when
 * they finished it - or to now, while it is still under way. A job that began yesterday starts at
 * midnight; one with no recorded start or finish is left out rather than guessed. */
function workedOn(
  requests: ServiceRequest[],
  times: Map<string, JobTimes> | undefined,
  technicianId: string,
  dayStart: number,
  now: number
): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const r of requests) {
    if (r.technician_id !== technicianId) continue;
    const card = times?.get(r.id);
    const started = card?.started_at ? new Date(card.started_at).getTime() : NaN;
    const running = r.status === 'in_progress' && !card?.completed_at;
    const ended = card?.completed_at ? new Date(card.completed_at).getTime() : running ? now : NaN;
    if (Number.isNaN(started) || Number.isNaN(ended) || ended <= dayStart || started >= dayStart + DAY_MS) continue;
    spans.push({
      id: r.id,
      request: r,
      ticket: ticketLabel(r.ticket_no),
      title: r.issue_type,
      from: (Math.max(started, dayStart) - dayStart) / 60_000,
      to: (Math.min(ended, dayStart + DAY_MS) - dayStart) / 60_000,
      running,
    });
  }
  return spans.sort((a, b) => a.from - b.from);
}

/** One stretch of today a job was offered to a technician and not yet answered: from when it was
 * assigned to when they accepted it - or to now, while it is still waiting. */
type OfferSpan = { id: string; request: ServiceRequest; ticket: string | null; title: string; from: number; to: number; waiting: boolean };

/** The jobs assigned to a technician on a day, each as the stretch it waited for them to accept. Once
 * accepted it stays here as how long the wait was, and its work shows on the other side of the rail. */
function offeredOn(
  requests: ServiceRequest[],
  times: Map<string, JobTimes> | undefined,
  technicianId: string,
  dayStart: number,
  now: number
): OfferSpan[] {
  const offers: OfferSpan[] = [];
  for (const r of requests) {
    if (r.technician_id !== technicianId || !r.assigned_at) continue;
    const offered = new Date(r.assigned_at).getTime();
    const startedIso = times?.get(r.id)?.started_at;
    const accepted = startedIso ? new Date(startedIso).getTime() : NaN;
    const waiting = r.status === 'assigned' && Number.isNaN(accepted);
    const answered = Number.isNaN(accepted) ? (waiting ? now : NaN) : accepted;
    if (Number.isNaN(offered) || Number.isNaN(answered) || answered < offered) continue;
    if (answered < dayStart || offered >= dayStart + DAY_MS) continue;
    offers.push({
      id: r.id,
      request: r,
      ticket: ticketLabel(r.ticket_no),
      title: r.issue_type,
      from: (Math.max(offered, dayStart) - dayStart) / 60_000,
      to: (Math.min(answered, dayStart + DAY_MS) - dayStart) / 60_000,
      waiting,
    });
  }
  return offers.sort((a, b) => a.from - b.from);
}

/** "09:00:00" -> 540 minutes from midnight. */
function minutesOf(time: string | null | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

function clock(minutes: number): string {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The stretches of the day an employee was busy, minutes from midnight, with jobs that overlap merged
 * into one: it is the time they were busy, not the sum of the jobs. `spans` come in start order. */
function busyIntervals(spans: DaySpan[]): [number, number][] {
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.from <= last[1]) last[1] = Math.max(last[1], s.to);
    else merged.push([s.from, s.to]);
  }
  return merged;
}

/** How long an employee has worked today, and how much of their duty time so far no job filled. */
function dayFigures(spans: DaySpan[], dutyFrom: number, dutyTo: number, nowMin: number) {
  const busy = busyIntervals(spans);
  const worked = busy.reduce((sum, [from, to]) => sum + (to - from), 0);
  // Only duty time that has already gone by can have gone unused.
  const passed = Math.min(dutyTo, nowMin);
  const duty = Math.max(0, passed - dutyFrom);
  const used = busy.reduce((sum, [from, to]) => sum + Math.max(0, Math.min(to, passed) - Math.max(from, dutyFrom)), 0);
  return { worked, unused: Math.max(0, duty - used) };
}

const minutesLabel = (minutes: number) => (minutes < 1 ? '0m' : formatDuration(minutes * 60_000));

/** In an employee's day: green for the time they worked, red for the duty time that went unused. */
const WORKED_GREEN = '#4ADE80';
const UNUSED_RED = '#F87171';

/** How tall one hour is in an employee's day. */
const HOUR_PX = 36;
const DAY_PX = 24 * HOUR_PX;
/** The hour numbers (and the day's colour behind them) run down the middle of the day. */
const HOURS_PX = 22;
/** Each job holds a bar, to the minute, beside the hour numbers - up to three side by side - and its
 * label or card stands next to the bars. */
const BAR_PX = 8;
const BAR_STEP = 10;
const MAX_BARS = 3;
const LABEL_H = 32;
/** How tall a job's card is taken to be until it has been drawn and measured. */
const CARD_H_GUESS = 170;

/** Things that overlap in time sit side by side in lanes; one with nothing alongside it takes the
 * whole width. `items` come in start order. */
function inLanes<T extends { from: number; to: number }>(items: T[]) {
  const placed: { item: T; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const closeGroup = () => {
    for (const entry of group) entry.lanes = Math.max(1, laneEnds.length);
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (group.length > 0 && item.from >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= item.from);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.to;
    groupEnd = Math.max(groupEnd, item.to);
    group.push({ item, lane, lanes: 1 });
  }
  closeGroup();
  return placed;
}

/** One job on an employee's day: the stretch it was waiting for them (kind "offer", the left side) or
 * the stretch they worked on it (kind "work", the right side). */
type DayItem = {
  /** Unique on the day: a job can stand on both sides. */
  id: string;
  request: ServiceRequest;
  kind: 'offer' | 'work';
  from: number;
  to: number;
  /** Still open - waiting to be accepted, or being worked: it stands as the job's full card, with its
   * buttons. A finished one is a short label. */
  live: boolean;
  /** For a work item: still going. For an offer item: nobody has answered it yet. */
  open: boolean;
};

/** An employee's whole day in one table, 0 to 24 hours from top to bottom, across the full width of
 * their column. The hour numbers run down the middle, over the day's colour; assigned work stands on
 * the left, accepted work on the right. A job stands where its time is: a job given to them starts on
 * the left at the moment it was assigned (amber, running down to now while it waits), and once they
 * accept it, it starts on the right at the moment they accepted it (blue, green while it is still
 * going) - its full card while it is open, a short label once it is done. Beside the hour numbers each
 * job also has a bar from its start to its end, so how long it held them can be read to the minute. A
 * red line marks now. */
function EmployeeDay({
  items,
  busy,
  dutyFrom,
  dutyTo,
  nowMin,
  showNow,
  renderCard,
}: {
  items: DayItem[];
  /** The stretches they worked (see busyIntervals), for the strip's green. */
  busy: [number, number][];
  dutyFrom: number;
  dutyTo: number;
  /** How far into the day it is: the real time on today, the whole day (1440) on a day gone by, 0 on a day to come. */
  nowMin: number;
  /** Draw the red line for now - only on today. */
  showNow: boolean;
  renderCard: (request: ServiceRequest) => React.ReactNode;
}) {
  // A card's height is only known once it has been drawn; until then it is guessed.
  const [cardHeight, setCardHeight] = useState<Record<string, number>>({});
  const px = (minutes: number) => (Math.min(Math.max(minutes, 0), 1440) / 60) * HOUR_PX;
  const passed = Math.min(dutyTo, nowMin);

  const layOut = (kind: DayItem['kind']) => {
    const list = items.filter((item) => item.kind === kind).sort((a, b) => a.from - b.from);
    // A card or label starts at its job's start, or just under the one above it when they would overlap.
    let cursor = 0;
    const labels = list.map((item) => {
      const height = item.live ? (cardHeight[item.id] ?? CARD_H_GUESS) : LABEL_H;
      const top = Math.max(px(item.from), cursor);
      cursor = top + height + 4;
      return { item, top, height };
    });
    const bars = inLanes(list);
    const gutter = Math.min(MAX_BARS, Math.max(1, ...bars.map((bar) => bar.lanes))) * BAR_STEP;
    return { labels, bars, gutter, bottom: cursor };
  };
  const left = layOut('offer');
  const right = layOut('work');
  const bandHeight = Math.max(DAY_PX, left.bottom, right.bottom);

  const colourOf = (item: DayItem) =>
    item.kind === 'offer' ? (item.open ? '#FBBF24' : '#FDE68A') : item.open ? '#16A34A' : BLUE;

  const lane = (kind: DayItem['kind'], laid: ReturnType<typeof layOut>) => {
    const onRight = kind === 'work';
    const inset = laid.gutter + 6;
    return (
      <View style={{ flex: 1, height: bandHeight }}>
        {laid.bars.map(({ item, lane: index }) => (
          <View
            key={`bar-${item.id}`}
            style={{
              position: 'absolute',
              top: px(item.from),
              height: Math.max(px(item.to) - px(item.from), 4),
              width: BAR_PX,
              borderRadius: 3,
              backgroundColor: colourOf(item),
              ...(onRight ? { left: 2 + Math.min(index, MAX_BARS - 1) * BAR_STEP } : { right: 2 + Math.min(index, MAX_BARS - 1) * BAR_STEP }),
            }}
          />
        ))}
        {laid.labels.map(({ item, top }) => {
          const place = onRight ? { left: inset, right: 2 } : { left: 2, right: inset };
          if (item.live) {
            return (
              <View
                key={item.id}
                style={{ position: 'absolute', top, ...place }}
                onLayout={(e) => {
                  const height = Math.round(e.nativeEvent.layout.height);
                  setCardHeight((prev) => (Math.abs((prev[item.id] ?? 0) - height) > 1 ? { ...prev, [item.id]: height } : prev));
                }}
              >
                {renderCard(item.request)}
              </View>
            );
          }
          const waited = formatDuration((item.to - item.from) * 60_000);
          return (
            <View
              key={item.id}
              style={{
                position: 'absolute',
                top,
                height: LABEL_H,
                ...place,
                borderRadius: 4,
                borderLeftWidth: 3,
                borderLeftColor: colourOf(item),
                backgroundColor: item.kind === 'offer' ? '#FEF3C7' : '#DBEAFE',
                paddingHorizontal: 6,
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Text className="text-[10.5px] font-bold" style={{ color: item.kind === 'offer' ? '#78350F' : '#1E3A8A' }} numberOfLines={1}>
                {`${ticketLabel(item.request.ticket_no) ?? ''} ${item.request.issue_type}`.trim()}
              </Text>
              <Text className="text-[9.5px]" style={{ color: item.kind === 'offer' ? '#78350F' : '#1E3A8A' }} numberOfLines={1}>
                {`${clock(item.from)}–${clock(item.to)} · ${item.kind === 'offer' ? `accepted in ${waited}` : waited}`}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View>
      <View className="flex-row" style={{ height: 16 }}>
        <Text className="flex-1 text-center text-[9.5px] font-bold" style={{ color: '#B45309' }}>
          Assigned
        </Text>
        <View style={{ width: HOURS_PX }} />
        <Text className="flex-1 text-center text-[9.5px] font-bold" style={{ color: '#15803D' }}>
          Accepted
        </Text>
      </View>
      <View
        style={{
          height: bandHeight,
          flexDirection: 'row',
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
          <View
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: px(h * 60),
              height: 1,
              backgroundColor: h % 6 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.07)',
            }}
          />
        ))}
        {lane('offer', left)}
        {/* The middle strip, as wide as the hour numbers: white for duty hours still to come, red for duty
            time that went unused, green for time worked, grey off duty. */}
        <View style={{ width: HOURS_PX, height: bandHeight, backgroundColor: '#E5E7EB', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#D1D5DB' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: px(dutyFrom), height: px(dutyTo) - px(dutyFrom), backgroundColor: '#FFFFFF' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: px(dutyFrom), height: Math.max(0, px(passed) - px(dutyFrom)), backgroundColor: UNUSED_RED }} />
          {busy.map(([from, to]) => (
            <View key={from} style={{ position: 'absolute', left: 0, right: 0, top: px(from), height: Math.max(px(to) - px(from), 2), backgroundColor: WORKED_GREEN }} />
          ))}
          {Array.from({ length: 24 }, (_, h) => (
            <Text key={h} className="text-[9px] font-semibold text-gray-800" style={{ position: 'absolute', left: 3, top: px(h * 60) + 1 }}>
              {h}
            </Text>
          ))}
        </View>
        {lane('work', right)}
        {showNow && <View style={{ position: 'absolute', left: 0, right: 0, top: px(nowMin) - 1, height: 2, backgroundColor: '#DC2626' }} />}
      </View>
    </View>
  );
}

function Column({
  title,
  subtitle,
  count,
  color,
  tint,
  avatar,
  phone,
  headerExtra,
  children,
  wide,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: string;
  tint: string;
  avatar?: { name: string | null; photoUrl: string | null };
  phone?: string | null;
  /** Under the name in the column's header - how long an employee worked today. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  wide: boolean;
}) {
  return (
    <View
      className="rounded-2xl border border-gray-200 bg-gray-50"
      style={wide ? { minWidth: 320, flexBasis: 320, flexGrow: 1, flexShrink: 0 } : undefined}
    >
      <View className="rounded-t-2xl px-3.5 py-3" style={{ backgroundColor: tint, gap: 8 }}>
        <View className="flex-row items-center gap-2.5">
          {avatar ? (
            <PersonAvatar name={avatar.name} photoUrl={avatar.photoUrl} size={34} bg="bg-blue-600" />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
              <Ionicons name="people" size={16} color="#FFFFFF" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-[14px] font-bold text-gray-900" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-[11px] text-gray-600" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          {!!phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${phone}`)}
              hitSlop={6}
              className="h-8 w-8 items-center justify-center rounded-full bg-white"
              accessibilityLabel={`Call ${title}`}
            >
              <Ionicons name="call-outline" size={15} color={color} />
            </Pressable>
          )}
          <View className="h-6 min-w-6 items-center justify-center rounded-full px-1.5" style={{ backgroundColor: color }}>
            <Text className="text-[11.5px] font-extrabold text-white">{count}</Text>
          </View>
        </View>
        {headerExtra}
      </View>
      <View className="p-3" style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const PAY_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: '#047857', bg: '#ECFDF5' },
  partial: { label: 'Part paid', color: '#4B5563', bg: '#F3F4F6' },
  unpaid: { label: 'Unpaid', color: '#B91C1C', bg: '#FEF2F2' },
};

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text className="text-[10.5px] font-bold" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface PickPerson {
  id: string;
  name: string | null;
  photoUrl: string | null;
  line: string;
  free?: boolean;
}

/** Who should do this job: the people who work for you. Pick one and it goes straight to them. */
function AssignSheet({
  request,
  people,
  onPick,
  onClose,
  busy,
}: {
  request: ServiceRequest | null;
  people: PickPerson[];
  onPick: (person: PickPerson) => void;
  onClose: () => void;
  busy: boolean;
}) {
  if (!request) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 420, maxHeight: '85%' }}>
          <View className="flex-row items-center gap-2.5 px-5 py-4" style={{ backgroundColor: BLUE }}>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-white">Give this to your staff</Text>
              <Text className="mt-0.5 text-[11.5px] text-white/85" numberOfLines={1}>
                {request.issue_type} · {request.customer_name ?? 'Customer'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView>
            {people.length === 0 ? (
              <Text className="px-5 py-5 text-sm text-gray-500">Nobody works for you yet - add your team under My team.</Text>
            ) : (
              people.map((person, i) => (
                <Pressable
                  key={person.id}
                  onPress={() => !busy && onPick(person)}
                  disabled={busy}
                  className={`flex-row items-center gap-3 px-5 py-3.5 disabled:opacity-60 ${i === people.length - 1 ? '' : 'border-b border-gray-100'}`}
                >
                  <PersonAvatar name={person.name} photoUrl={person.photoUrl} size={36} bg="bg-blue-600" />
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-gray-900" numberOfLines={1}>
                      {person.name ?? 'Technician'}
                    </Text>
                    <Text className="text-[11.5px] text-gray-500" numberOfLines={1}>
                      {person.line}
                    </Text>
                  </View>
                  <Text className="text-[12px] font-semibold" style={{ color: BLUE }}>
                    Assign
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Text className="border-t border-gray-100 px-5 py-3 text-[11px] leading-[16px] text-gray-500">
            It rings on their phone; they accept or reject it.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** What a hold on a job looks like, beside its status. */
const HOLD_CHIP = {
  requested: { label: 'Hold requested', color: '#4B5563', bg: '#F3F4F6' },
  on_hold: { label: 'On hold', color: '#4B5563', bg: '#F3F4F6' },
} as const;

/** One fact about a job: a small label over its value. The cells of a card sit
 * on a hairline, like the detail page's hero. */
function Fact({
  label,
  children,
  roomy,
  full,
  icon,
  initials,
}: {
  label: string;
  children: React.ReactNode;
  roomy: boolean;
  /** Takes a whole row of its own - for a longer piece of text. */
  full?: boolean;
  /** A round badge beside the fact: an icon, or the initials of a person. */
  icon?: keyof typeof Ionicons.glyphMap;
  initials?: string;
}) {
  const badge = icon || initials ? (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: 36, height: 36, backgroundColor: initials ? '#374151' : '#F3F4F6' }}
    >
      {initials ? (
        <Text className="text-[13px] font-bold text-white">{initials}</Text>
      ) : (
        <Ionicons name={icon!} size={18} color="#4B5563" />
      )}
    </View>
  ) : null;
  return (
    <View
      className="flex-row px-4 py-3.5"
      style={{ gap: 12, backgroundColor: '#FFFFFF', ...(roomy ? (full ? { flexBasis: '100%' } : { flexGrow: 1, flexBasis: 200, minWidth: 200 }) : null) }}
    >
      {badge}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text className="text-[12px] font-semibold capitalize" style={{ color: '#6B7280' }}>
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

type CardAction = { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'ghost' | 'done'; onPress: () => void };

const ACTION_TONE = {
  primary: { bg: '#0F766E', border: '#0F766E', fg: '#FFFFFF' },
  ghost: { bg: '#FFFFFF', border: '#D1D5DB', fg: '#374151' },
  done: { bg: '#F0FDF4', border: '#86EFAC', fg: '#166534' },
} as const;

/** One job as a card, top to bottom: what it is and what it is worth; the few
 * facts you act on (who it is for, where, when, who has it); where it has got
 * to; and what you can do about it. */
function JobRowCard({
  request: r,
  times,
  now,
  technicianName,
  onAssign,
  onCancelWork,
  onDeleteWork,
  onMarkDone,
  onOpenToTeam,
  busy,
  roomy,
  expanded,
}: {
  request: ServiceRequest;
  times: JobTimes | undefined;
  now: number;
  technicianName: (id: string) => string;
  onAssign: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
  onDeleteWork: (request: ServiceRequest) => void;
  onMarkDone: (request: ServiceRequest) => void;
  onOpenToTeam: (request: ServiceRequest, open: boolean) => void;
  busy: boolean;
  roomy: boolean;
  expanded?: boolean;
}) {
  const open = () => router.push(`/(reseller)/request/${r.id}` as any);
  const chip = r.status === 'in_progress' ? { label: 'Working on it', color: '#166534', bg: '#DCFCE7' } : statusChip(r);
  const pay = PAY_CHIP[r.payment_status] ?? PAY_CHIP.unpaid;
  const hold = r.hold_status === 'requested' ? HOLD_CHIP.requested : r.hold_status === 'on_hold' ? HOLD_CHIP.on_hold : null;
  const lines = expanded ? undefined : 2;
  const scheduled = formatScheduledWhen(r.scheduled_date, r.scheduled_time);
  const issue = splitIssue(r.issue_type);
  const overdue = isOverdue(r);
  const pay2 = PAY_CHIP[r.payment_status] ?? PAY_CHIP.unpaid;
  const holdWord = r.hold_status === 'requested' ? 'Hold requested' : r.hold_status === 'on_hold' ? 'On hold' : null;
  const statusNote = [chip.label, holdWord, overdue ? `Overdue by ${overdueBy(r)}` : null, pay2.label].filter(Boolean).join(' · ');
  // What the customer wrote when they asked for the job - the first thing to read.
  const customerRequest = r.description?.trim();

  // What you can do, most useful first. A hold waiting on you comes before everything.
  const actions: CardAction[] = [];
  if (r.hold_status === 'requested') {
    actions.push({ label: 'Review hold request', icon: 'pause-circle-outline', tone: 'primary', onPress: open });
  }
  const mainTone = r.hold_status === 'requested' ? 'ghost' : 'primary';
  if (r.technician_id) {
    actions.push({ label: 'Reassign', icon: 'person-add-outline', tone: mainTone, onPress: () => onAssign(r) });
  } else if (r.open_to_team) {
    actions.push({ label: 'Assign instead', icon: 'person-add-outline', tone: mainTone, onPress: () => onAssign(r) });
    actions.push({ label: 'Take back', icon: 'close-circle-outline', tone: 'ghost', onPress: () => onOpenToTeam(r, false) });
  } else {
    actions.push({ label: 'Assign', icon: 'person-add-outline', tone: mainTone, onPress: () => onAssign(r) });
    actions.push({ label: 'Open to team', icon: 'megaphone-outline', tone: 'ghost', onPress: () => onOpenToTeam(r, true) });
  }
  // The work is finished but nobody completed it in the app (a technician who does not use it).
  if (canMarkJobDone(r)) {
    actions.push({ label: 'Mark as done', icon: 'checkmark-done-outline', tone: 'done', onPress: () => onMarkDone(r) });
  }
  if (canEditJob(r)) {
    actions.push({ label: 'Edit', icon: 'create-outline', tone: 'ghost', onPress: () => router.push(editJobHref(r.id) as any) });
  }

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(16,24,40,0.06)' }}
    >
      <Pressable onPress={open} className="flex-row items-center gap-3.5 px-5 py-4">
        <CategoryBadge category={r.issue_type} size={roomy ? 48 : 40} />
        <View className="flex-1" style={{ gap: 5, minWidth: 0 }}>
          {!!issue.eyebrow && (
            <Text className="text-[11.5px] font-semibold capitalize tracking-wide" style={{ color: '#64748B' }} numberOfLines={1}>
              {issue.eyebrow}
            </Text>
          )}
          <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
            <TicketChip no={r.ticket_no} prefix="Token" />
            <Text className="text-[19px] font-bold text-gray-900" style={{ flexShrink: 1, minWidth: 0 }} numberOfLines={lines}>
              {issue.title}
            </Text>
          </View>
          {/* On a phone the price would squeeze the title, so it sits under it. */}
          {!roomy && (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-[15px] font-extrabold text-gray-900">{money(r.quoted_price)}</Text>
            </View>
          )}
        </View>
        {roomy && (
          <View className="flex-row items-center rounded-xl border border-gray-200 px-4 py-2.5" style={{ gap: 14, backgroundColor: '#FFFFFF' }}>
            <View className="items-end" style={{ gap: 2 }}>
              <Text className="text-[12px] font-semibold" style={{ color: '#64748B' }}>
                Job amount
              </Text>
              <Text className="text-[20px] font-bold text-gray-900">{money(r.quoted_price)}</Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* White cells on a hairline ground with a 1px gap: the dividers stay right however the cells wrap. */}
      <View
        style={{
          backgroundColor: '#F3F4F6',
          gap: 1,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          flexDirection: roomy ? 'row' : 'column',
          flexWrap: roomy ? 'wrap' : 'nowrap',
        }}
      >
        {!!customerRequest && (
          <Fact label="Customer's request" roomy={roomy} full>
            <Text className="text-[13.5px] leading-[20px] text-gray-800" numberOfLines={expanded ? undefined : 3}>
              {customerRequest}
            </Text>
          </Fact>
        )}
        <Fact label="Customer" roomy={roomy} icon="person-outline">
          <Text className="text-[13.5px] font-semibold text-gray-900" numberOfLines={lines}>
            {r.customer_name ?? 'Customer'}
          </Text>
          {!!r.customer_phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${r.customer_phone}`)} className="flex-row items-center gap-1 self-start">
              <Ionicons name="call-outline" size={12} color="#0F766E" />
              <Text className="text-[12.5px] font-medium" style={{ color: '#0F766E' }}>
                {r.customer_phone}
              </Text>
            </Pressable>
          )}
        </Fact>
        <Fact label="Location" roomy={roomy} icon="location-outline">
          <Text className="text-[13.5px] font-semibold text-gray-900" numberOfLines={lines}>
            {r.location_data?.address ?? 'No address'}
          </Text>
        </Fact>
        <Fact label="Scheduled" roomy={roomy} icon="calendar-outline">
          <Text className="text-[13.5px] font-semibold text-gray-900" numberOfLines={lines}>
            {scheduled ?? 'Not scheduled'}
          </Text>
        </Fact>
        <Fact
          label="Technician"
          roomy={roomy}
          icon={r.technician_id ? undefined : 'people-outline'}
          initials={r.technician_id ? initialsOf(technicianName(r.technician_id)) : undefined}
        >
          {r.technician_id ? (
            <Text className="text-[13.5px] font-semibold text-gray-900" numberOfLines={lines}>
              {technicianName(r.technician_id)}
            </Text>
          ) : (
            <Text className="text-[13.5px] font-semibold" style={{ color: r.open_to_team ? '#047857' : '#4B5563' }}>
              {r.open_to_team ? 'Open to the team' : 'Nobody yet'}
            </Text>
          )}
        </Fact>
      </View>

      {/* Where the job has got to. */}
      {roomy ? (
        <View className="pt-3.5" style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
          <JobTimeline request={r} times={times} now={now} layout="strip" statusNote={statusNote} />
        </View>
      ) : (
        <View className="px-4 pb-1">
          <JobTimeline request={r} times={times} now={now} layout="list" statusNote={statusNote} />
        </View>
      )}

      <View
        className="flex-row flex-wrap items-center border-t border-gray-100 px-5 py-3.5"
        style={{ gap: 10, justifyContent: roomy ? 'space-between' : 'flex-start' }}
      >
        {/* Cancel keeps the job (in the Cancelled tab); Delete removes it for good. */}
        <View className="flex-row flex-wrap items-center" style={{ gap: 10, ...(roomy ? null : { flexGrow: 1, flexBasis: 120 }) }}>
          {canCancelWork(r) && (
            <Pressable
              onPress={() => onCancelWork(r)}
              disabled={busy}
              accessibilityLabel="Cancel job"
              className="h-11 flex-row items-center justify-center gap-2 rounded-lg px-3 disabled:opacity-50"
              style={roomy ? undefined : { flexGrow: 1, flexBasis: 100 }}
            >
              <Ionicons name="close-circle-outline" size={18} color="#B91C1C" />
              <Text className="text-[14px] font-semibold" style={{ color: '#B91C1C' }}>
                Cancel job
              </Text>
            </Pressable>
          )}
          {canDeleteJob(r) && (
            <Pressable
              onPress={() => onDeleteWork(r)}
              disabled={busy}
              accessibilityLabel="Delete job"
              className="h-11 flex-row items-center justify-center gap-2 rounded-lg px-3 disabled:opacity-50"
              style={roomy ? undefined : { flexGrow: 1, flexBasis: 100 }}
            >
              <Ionicons name="trash-outline" size={18} color="#B91C1C" />
              <Text className="text-[14px] font-semibold" style={{ color: '#B91C1C' }}>
                Delete job
              </Text>
            </Pressable>
          )}
        </View>
        <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
          {actions
            .slice()
            .reverse()
            .map((a) => {
              const tone = ACTION_TONE[a.tone];
              const label = a.label === 'Reassign' ? 'Reassign technician' : a.label;
              return (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  disabled={busy}
                  className="h-11 flex-row items-center justify-center gap-2 rounded-lg px-5 disabled:opacity-50"
                  style={{
                    backgroundColor: tone.bg,
                    borderWidth: 1,
                    borderColor: tone.border,
                    ...(roomy ? null : { flexGrow: 1, flexBasis: 120 }),
                  }}
                >
                  <Ionicons name={a.icon} size={18} color={tone.fg} />
                  <Text className="text-[14px] font-semibold" style={{ color: tone.fg }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      </View>
    </View>
  );
}

/** One job on one short row, so a whole page of work fits on the screen at once: what and who,
 * where and when, the technician, the amount, how far along it is, and the actions as buttons.
 * Every cell is one line, cut with an ellipsis when it is long. The columns (and the header over
 * them) come from JobTable.tsx; a narrower table folds Address and Technician under the customer
 * and the date under the job. */
function JobCompactRow({
  request: r,
  times,
  now,
  technicianName,
  tier,
  onAssign,
  onCancelWork,
  onDeleteWork,
  onMarkDone,
  busy,
}: {
  request: ServiceRequest;
  times: JobTimes | undefined;
  /** The current time, ticking each minute, so "Running: 2h 10m" keeps counting. */
  now: number;
  technicianName: (id: string) => string;
  tier: Tier;
  onAssign: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
  onDeleteWork: (request: ServiceRequest) => void;
  onMarkDone: (request: ServiceRequest) => void;
  busy: boolean;
}) {
  useCalendarMode(); // draws the date again when the AD / BS toggle changes
  const open = () => router.push(`/(reseller)/request/${r.id}` as any);
  const chip = r.status === 'in_progress' ? { label: 'Working on it', color: '#166534', bg: '#DCFCE7' } : statusChip(r);
  const pay = PAY_CHIP[r.payment_status] ?? PAY_CHIP.unpaid;
  const hold = r.hold_status === 'requested' ? HOLD_CHIP.requested : r.hold_status === 'on_hold' ? HOLD_CHIP.on_hold : null;
  const issue = splitIssue(r.issue_type);
  const overdue = isOverdue(r);
  const dateText = numericDateLabel(r.scheduled_date ?? entryDay(null, r.created_at));
  // The time the job was put in, under the date.
  const registered = new Date(r.created_at);
  const registeredTime = `${String(registered.getHours()).padStart(2, '0')}:${String(registered.getMinutes()).padStart(2, '0')}`;
  // What the customer wrote when they asked for the job.
  const customerRequest = r.description?.trim();

  // The one action that moves the job on, then Edit; a hold waiting on you comes first.
  const mainLabel = r.hold_status === 'requested' ? 'Review hold' : r.technician_id ? 'Reassign' : 'Assign';
  const mainIcon: keyof typeof Ionicons.glyphMap = r.hold_status === 'requested' ? 'pause-circle-outline' : 'person-add-outline';
  const mainPress = r.hold_status === 'requested' ? open : () => onAssign(r);

  // The Assign button has a column of its own (see JobTableHeader splitAssign), apart from the icons.
  const has = (key: ColKey) => columnsOf(tier, true).includes(key);
  const w = TIER_WIDTH[tier];
  const cell = { minWidth: 0 } as const;
  const stages = jobStages(r, times);
  const statusLine = [chip.label, hold?.label, overdue ? `Overdue by ${overdueBy(r)}` : null, pay.label].filter(Boolean).join(' · ');
  const techText = r.technician_id ? technicianName(r.technician_id) : r.open_to_team ? 'Open to the team' : 'Nobody yet';
  // When the work began and how long it has been going (a job under way), or when it was offered and
  // how long it has been waiting for an answer. `now` ticks each minute, so the figure keeps counting.
  const stamp = (iso: string) => {
    const d = new Date(iso);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${numericDateLabel(entryDay(null, iso))}, ${time}`;
  };
  const timeLines: string[] = [];
  if (r.status === 'in_progress') {
    const begun = times?.started_at;
    if (begun) {
      timeLines.push(`Started: ${stamp(begun)}`);
      timeLines.push(`Running: ${formatDurationBetween(begun, new Date(now))}`);
    }
  } else if (r.status === 'assigned' && r.assigned_at) {
    timeLines.push(`Offered: ${stamp(r.assigned_at)}`);
    timeLines.push(`Waiting: ${formatDurationBetween(r.assigned_at, new Date(now))}`);
  }
  const address = r.location_data?.address ?? null;
  return (
    <View
      className="flex-row items-center rounded-lg bg-white"
      style={{
        gap: TIER_GAP[tier],
        justifyContent: 'space-between',
        paddingHorizontal: ROW_PAD_X,
        paddingVertical: ROW_PAD_Y,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}
    >
      <Text className="text-[12px] font-bold text-gray-800" style={{ width: w.token, flexShrink: 0 }} numberOfLines={1}>
        {ticketLabel(r.ticket_no) ?? '—'}
      </Text>

      {has('when') && (
        <View style={{ width: w.when, flexShrink: 0 }}>
          <Text className="text-[12px] text-gray-800" numberOfLines={1}>
            {dateText || '—'}
          </Text>
          <Text className="text-[10.5px] text-gray-500" numberOfLines={1}>
            {`Added ${registeredTime}`}
          </Text>
        </View>
      )}

      {/* Not a button: the row does not open the job page; its buttons on the right are the way in. */}
      <View className="flex-row items-center" style={{ gap: 8, width: w.job, flexShrink: 1, ...cell }}>
        <CategoryBadge category={r.issue_type} size={60} />
        <View style={{ flex: 1, gap: 1, ...cell }}>
          {!!issue.eyebrow && (
            <Text className="text-[13px] font-bold text-gray-900" numberOfLines={2}>
              {issue.eyebrow.toUpperCase()}
            </Text>
          )}
          <Text className="text-[13px] font-bold text-gray-900" numberOfLines={1}>
            {issue.title}
          </Text>
          {!!customerRequest && (
            <Text className="text-[11px] text-gray-600" numberOfLines={2}>
              {customerRequest}
            </Text>
          )}
          {!!r.chalan_no?.trim() && (
            <Text className="text-[11px] font-semibold text-gray-600" numberOfLines={1}>
              {`Chalan no. ${r.chalan_no.trim()}${r.chalan_urls.length > 0 ? ' · photo added' : ''}`}
            </Text>
          )}
        </View>
      </View>

      <View style={{ width: w.customer, flexShrink: 1, ...cell }}>
        <Text className="text-[12.5px] font-semibold text-gray-900" numberOfLines={1}>
          {r.customer_name ?? 'Customer'}
        </Text>
        {!!r.customer_phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${r.customer_phone}`)} className="self-start">
            <Text className="text-[11px] font-medium" style={{ color: '#0F766E' }} numberOfLines={1}>
              {r.customer_phone}
            </Text>
          </Pressable>
        )}
        {/* A narrower table has no Address / Technician column: they are under the customer. */}
        {!has('where') && !!address && (
          <Text className="text-[11px] text-gray-600" numberOfLines={1}>
            {address}
          </Text>
        )}
        {!has('tech') && (
          <Text className="text-[11px] text-gray-500" numberOfLines={1}>
            {r.technician_id ? `Technician: ${techText}` : techText}
          </Text>
        )}
      </View>

      {has('where') && (
        <View style={{ width: w.where, flexShrink: 1, ...cell }}>
          <Text className="text-[12px] text-gray-800" numberOfLines={1}>
            {address ?? 'No address'}
          </Text>
        </View>
      )}

      {/* No pencil here: a job is changed on purpose, with the Edit button, not by a stray tap on its price. */}
      <EditableAmount display={r.quoted_price != null ? money(r.quoted_price) : ''} value={r.quoted_price} width={w.amount} />

      {has('tech') && (
        <View className="flex-row items-center" style={{ width: w.tech, flexShrink: 0, gap: 6, ...cell }}>
          {r.technician_id ? (
            <>
              <View className="items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: '#374151' }}>
                <Text className="text-[9.5px] font-bold text-white">{initialsOf(techText)}</Text>
              </View>
              <Text className="flex-1 text-[12px] font-semibold text-gray-900" numberOfLines={1}>
                {techText}
              </Text>
            </>
          ) : (
            <Text className="text-[12px] font-semibold" style={{ color: r.open_to_team ? '#047857' : '#4B5563' }} numberOfLines={1}>
              {techText}
            </Text>
          )}
        </View>
      )}

      {/* Assigned / WIP / Hold / Completed, and under them how the job stands. */}
      <View style={{ width: w.status, flexShrink: 0 }}>
        <JobProgressBars steps={stages} note={statusLine} details={timeLines} />
      </View>

      <View style={{ width: widthOf(tier, 'assign', true), flexShrink: 0 }}>
        <Pressable
          onPress={mainPress}
          disabled={busy}
          accessibilityLabel={mainLabel}
          className="flex-row items-center justify-center rounded-lg disabled:opacity-50"
          style={{ height: ROW_BUTTON_HEIGHT, paddingHorizontal: 8, gap: 5, minWidth: 0, backgroundColor: '#0F766E' }}
        >
          <Ionicons name={mainIcon} size={14} color="#FFFFFF" />
          <Text className="text-[12px] font-semibold text-white" style={{ flexShrink: 1 }} numberOfLines={1}>
            {mainLabel}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-end" style={{ gap: 4, width: widthOf(tier, 'actions', true), flexShrink: 0 }}>
        {canEditJob(r) && (
          <Pressable
            onPress={() => router.push(editJobHref(r.id) as any)}
            disabled={busy}
            accessibilityLabel="Edit job"
            className="items-center justify-center rounded-lg disabled:opacity-50"
            style={{ width: ROW_BUTTON_HEIGHT, height: ROW_BUTTON_HEIGHT, flexShrink: 0, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
          >
            <Ionicons name="create-outline" size={16} color="#1D4ED8" />
          </Pressable>
        )}
        {canMarkJobDone(r) && (
          <Pressable
            onPress={() => onMarkDone(r)}
            disabled={busy}
            accessibilityLabel="Mark as done"
            className="items-center justify-center rounded-lg disabled:opacity-50"
            style={{ width: ROW_BUTTON_HEIGHT, height: ROW_BUTTON_HEIGHT, flexShrink: 0, borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#166534" />
          </Pressable>
        )}
        {canCancelWork(r) && (
          <Pressable
            onPress={() => onCancelWork(r)}
            disabled={busy}
            accessibilityLabel="Cancel job"
            className="items-center justify-center rounded-lg disabled:opacity-50"
            style={{ width: ROW_BUTTON_HEIGHT, height: ROW_BUTTON_HEIGHT, flexShrink: 0, borderWidth: 1, borderColor: '#FECACA' }}
          >
            <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
          </Pressable>
        )}
        {canDeleteJob(r) && (
          <Pressable
            onPress={() => onDeleteWork(r)}
            disabled={busy}
            accessibilityLabel="Delete job"
            className="items-center justify-center rounded-lg disabled:opacity-50"
            style={{ width: ROW_BUTTON_HEIGHT, height: ROW_BUTTON_HEIGHT, flexShrink: 0, borderWidth: 1, borderColor: '#FECACA' }}
          >
            <Ionicons name="trash-outline" size={15} color="#B91C1C" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The jobs of a stage, one card each - side-by-side facts when the column is
 * wide enough, stacked when it is not. Beside the sidebar a "wide" page can
 * still leave this list a narrow column, so it goes by its own width. */
function JobList({
  jobs,
  times,
  now,
  technicianName,
  onAssign,
  onCancelWork,
  onDeleteWork,
  onMarkDone,
  onOpenToTeam,
  busyId,
  wide,
  expanded,
  dense,
  emptyText,
}: {
  jobs: ServiceRequest[];
  /** Each job's start / finish moments, for its timeline. */
  times: Map<string, JobTimes> | undefined;
  now: number;
  technicianName: (id: string) => string;
  onAssign: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
  onDeleteWork: (request: ServiceRequest) => void;
  onMarkDone: (request: ServiceRequest) => void;
  onOpenToTeam: (request: ServiceRequest, open: boolean) => void;
  busyId: string | null;
  wide: boolean;
  /** Full screen: nothing is cut short, however long the job's name is. */
  expanded?: boolean;
  /** One short row per job, so many fit on the screen at once (wide screens only). */
  dense?: boolean;
  emptyText: string;
}) {
  const [boxWidth, setBoxWidth] = useState(0);
  const roomy = wide && !(boxWidth > 0 && boxWidth < 640);
  // Compact rows go by the table's columns; in a box narrower than the smallest size they keep
  // that size and the table scrolls sideways (JobTableScroll) instead of squeezing.
  const compact = !!dense && wide;
  const tier = tierFor(boxWidth > 0 ? boxWidth : FULL_TABLE_WIDTH);

  if (jobs.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
        <Ionicons name="clipboard-outline" size={26} color="#D1D5DB" />
        <Text className="mt-2 text-sm text-gray-500">{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: compact ? 6 : 12 }} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      {compact ? (
        <JobTableScroll available={boxWidth}>
          <JobTableHeader tier={tier} splitAssign />
          {jobs.map((r) => (
            <JobCompactRow
              key={r.id}
              request={r}
              times={times?.get(r.id)}
              now={now}
              technicianName={technicianName}
              tier={tier}
              onAssign={onAssign}
              onCancelWork={onCancelWork}
              onDeleteWork={onDeleteWork}
              onMarkDone={onMarkDone}
              busy={busyId === r.id}
            />
          ))}
        </JobTableScroll>
      ) : (
        jobs.map((r) => (
          <JobRowCard
            key={r.id}
            request={r}
            times={times?.get(r.id)}
            now={now}
            technicianName={technicianName}
            onAssign={onAssign}
            onCancelWork={onCancelWork}
            onDeleteWork={onDeleteWork}
            onMarkDone={onMarkDone}
            onOpenToTeam={onOpenToTeam}
            busy={busyId === r.id}
            roomy={roomy}
            expanded={expanded}
          />
        ))
      )}
    </View>
  );
}

/** What each stage that uses the panel calls itself. */
const STAGE_COPY = {
  my_jobs: {
    title: (n: number) => `${n} job${n === 1 ? '' : 's'}`,
    empty: 'No jobs right now.',
    note: 'Every job you are working - ones nobody has been given yet to assign, and ones a technician has accepted to follow.',
  },
  in_progress: {
    title: (n: number) => `${n} job${n === 1 ? '' : 's'} in progress`,
    empty: 'No jobs in progress right now.',
    note: 'Jobs a technician has been given.',
  },
} as const;

/** The body of Requests' "My Jobs" and "Job in progress" stages: who is doing
 * what, and what nobody has picked up yet. The list is the stage's own jobs
 * (the page that owns the stages passes them in); the board (one tap away) is
 * everything live, and the one place to see the whole team at once. Assigning
 * still happens on the job's own page too (it needs the technician list and the
 * price); this is the overview that page can't give. It was the Work Hub tab
 * before the two were merged. */
export function WorkHubPanel({
  wide,
  stage,
  jobs,
  boardOnly = false,
  initialQuery,
}: {
  wide: boolean;
  stage: keyof typeof STAGE_COPY;
  /** This stage's jobs. */
  jobs: ServiceRequest[];
  /** Show the board - the requests/board screen - instead of the stage's list. */
  boardOnly?: boolean;
  /** What the board's search box starts with - "Assign" on a job in the list opens the board on that job. */
  initialQuery?: string;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const businessName = useAuthStore((state) => state.profile?.business_name);
  const queryClient = useQueryClient();
  const updateRequest = useSupabaseUpdate('service_requests');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirmCancelWork, busyId: cancellingId } = useCancelWork();
  const { confirmDeleteJob, deletingId } = useDeleteJob();
  const { confirmMarkDone, doingId } = useMarkJobDone();
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [assigning, setAssigning] = useState<{ request: ServiceRequest } | null>(null);

  /** Opens the technician picker. A job still waiting to be accepted is simply offered to the new
   * person; one already in progress is handed over by the server (hand_over_job) - see sendJobTo. */
  function openPicker(request: ServiceRequest) {
    setAssigning({ request });
  }
  const [sending, setSending] = useState(false);
  const [maximised, setMaximised] = useState(false);
  // The sheet answers "what is on today"; the board answers "who is
  // carrying it". The board is a screen of its own (requests/board), not a
  // switch inside this one: a switch adds nothing to the history, so the
  // device's Back button skipped past the list to whatever page came before
  // Requests (usually Services).
  const view: 'sheet' | 'board' = boardOnly ? 'board' : 'sheet';
  const openBoard = () => router.push('/(reseller)/requests/board' as any);
  // "Assign" and "Reassign" on a job open the board on that job, where the team's workload is in view
  // and the job's card has the buttons to give it to someone.
  const assignFromList = (request: ServiceRequest) =>
    router.push(
      `/(reseller)/requests/board?find=${encodeURIComponent(ticketLabel(request.ticket_no) ?? request.customer_name ?? '')}` as any
    );
  // The board's search box: a ticket, customer, phone, job, address or technician.
  const [query, setQuery] = useState(initialQuery ?? '');
  useEffect(() => setQuery(initialQuery ?? ''), [initialQuery]);
  const closeBoard = () => (router.canGoBack() ? router.back() : router.replace('/(reseller)/requests' as any));
  // The board's columns slide sideways; the arrows over them do it with one click, as a mouse wheel
  // only scrolls up and down.
  const columnsRef = useRef<ScrollView>(null);
  const [slideX, setSlideX] = useState(0);
  const [slideView, setSlideView] = useState(0);
  const [slideContent, setSlideContent] = useState(0);
  const canSlide = slideContent > slideView + 4;
  const slide = (direction: -1 | 1) =>
    columnsRef.current?.scrollTo({ x: Math.max(0, slideX + direction * Math.max(334, Math.round(slideView * 0.6))), animated: true });
  // Full screen is a setting of this page, not a page: Back closes it before it leaves.
  useBackStep(maximised, () => setMaximised(false));
  // Beside the sidebar a "wide" page can still leave this panel a narrow column.
  const [boxWidth, setBoxWidth] = useState(0);
  const headerInRow = wide && !(boxWidth > 0 && boxWidth < 760);

  const { data: mine, isLoading } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  // The same unclaimed pool the Requests tab shows at its first stage -
  // nobody owns these yet, so they carry no reseller_id.
  const { data: incomingRaw } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    orderBy: { column: 'created_at', ascending: true },
  });
  const requests = useMemo(() => {
    const unclaimed = (incomingRaw ?? []).filter((r) => !r.reseller_id);
    return [...(mine ?? []), ...unclaimed];
  }, [mine, incomingRaw]);
  // Each job's timeline needs when its technician started and finished it.
  const jobTimes = useJobTimes(useMemo(() => requests.map((r) => r.id).sort(), [requests]));
  // A technician accepting or finishing a job shows on the board - and on the employee's day rail - at
  // once, not on the next refresh.
  useEffect(() => {
    if (!userId) return;
    return subscribeToTable(
      'service_requests',
      () => {
        queryClient.invalidateQueries({ queryKey: ['service_requests'] });
        queryClient.invalidateQueries({ queryKey: ['job-card-times'] });
      },
      `reseller_id=eq.${userId}`,
      'work-hub'
    );
  }, [userId, queryClient]);
  const now = useNow();
  // How far into today it is, for the red "now" line in each employee's day bar.
  const nowMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const today = entryDay(null, new Date(now).toISOString());
  // The day the employees' tables are for: today, or the one picked with the calendar.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay ?? today;
  const isToday = day === today;
  const [dayYear, dayMonth, dayDate] = day.split('-').map(Number);
  const dayStart = new Date(dayYear, dayMonth - 1, dayDate).getTime();
  // How far into that day it is: the real time on today, all of it on a day gone by, none on a day to come.
  const elapsedMinutes = isToday ? nowMinutes : day < today ? 1440 : 0;
  // The day in both calendars: "Tue, Nov 3, 2026 AD · Kartik 17, 2083 BS".
  const dayLabel = `${toAdLabel(day)} AD · ${toBsLabel(day)} BS`;
  useCalendarMode(); // the date button below is drawn again when the AD / BS toggle changes
  const { data: employees } = useMyEmployees(userId);

  // The list is this stage's jobs, the newest first - by the date and time each was put in. The
  // customer's name is the job's own, exactly as the job page shows it - the Ledger customer a job
  // happens to be linked to can carry a different name.
  const shown = useMemo(
    () => [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || (b.ticket_no ?? 0) - (a.ticket_no ?? 0)),
    [jobs]
  );
  const shownOverdue = shown.filter(isOverdue).length;

  // The board is about who is carrying work right now - all of it, not just
  // the jobs the list shows.
  const live = useMemo(() => requests.filter((r) => LIVE_STATUSES.includes(r.status)), [requests]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, ServiceRequest[]>();
    for (const r of live) {
      if (!r.technician_id) continue;
      const list = map.get(r.technician_id) ?? [];
      list.push(r);
      map.set(r.technician_id, list);
    }
    return map;
  }, [live]);

  const openToTeam = useMemo(() => live.filter((r) => !r.technician_id && r.open_to_team), [live]);
  const unassigned = useMemo(() => live.filter((r) => !r.technician_id && !r.open_to_team), [live]);

  // Technicians holding work who aren't (or are no longer) employees - an
  // outsource technician you offered a job to still belongs on the board.
  const outsideHolders = useMemo(() => {
    const employeeIds = new Set(employees.map((e) => e.profile.id));
    return [...byTechnician.keys()].filter((id) => !employeeIds.has(id));
  }, [byTechnician, employees]);
  const { data: allProfiles } = useSupabaseQuery('profiles', { enabled: outsideHolders.length > 0 });
  const profileById = useMemo(() => new Map((allProfiles ?? []).map((p: Profile) => [p.id, p])), [allProfiles]);

  const technicianName = (id: string) =>
    employees.find((e) => e.profile.id === id)?.profile.full_name ??
    profileById.get(id)?.full_name ??
    'Technician';

  // What the board shows once the search box is filled in; with nothing typed, all the live work.
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matchesSearch = (r: ServiceRequest) =>
    [
      ticketLabel(r.ticket_no),
      r.customer_name,
      r.customer_phone,
      r.company_name,
      r.issue_type,
      r.location_data?.address,
      r.technician_id ? technicianName(r.technician_id) : null,
    ].some((text) => !!text && text.toLowerCase().includes(needle));
  const found = searching ? live.filter(matchesSearch) : live;
  const foundUnassigned = found.filter((r) => !r.technician_id && !r.open_to_team);
  const foundOpenToTeam = found.filter((r) => !r.technician_id && r.open_to_team);
  const foundWith = (technicianId: string) => found.filter((r) => r.technician_id === technicianId);
  const foundOverdue = found.filter(isOverdue).length;

  // The page shows open work only; the saved record is the whole month,
  // finished jobs included - that is the point of keeping it.
  const monthRows = useMemo((): WorkRecordRow[] => {
    const since = Date.now() - 30 * DAY_MS;
    return (requests ?? [])
      .filter((r) => new Date(r.created_at).getTime() >= since || dueAt(r) >= since)
      .sort((a, b) => dueAt(a) - dueAt(b))
      .map((r) => ({
        Ticket: ticketLabel(r.ticket_no) ?? '',
        Date: r.scheduled_date ?? new Date(r.created_at).toISOString().slice(0, 10),
        Time: r.scheduled_time?.slice(0, 5) ?? '',
        Job: r.issue_type,
        Customer: r.customer_name ?? '',
        Phone: r.customer_phone ?? '',
        Address: r.location_data?.address ?? '',
        'Assigned to': r.technician_id ? technicianName(r.technician_id) : r.open_to_team ? 'Open to team' : 'Nobody yet',
        Status: STATUS_WORDS[r.status] ?? r.status,
        Payment: r.payment_status === 'paid' ? 'Paid' : 'Unpaid',
        Amount: r.quoted_price == null ? '' : Number(r.quoted_price),
      }));
  }, [requests, employees, allProfiles]);

  const periodLabel = `${new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10)} to ${new Date().toISOString().slice(0, 10)}`;
  const fileStem = `work-record-${new Date().toISOString().slice(0, 10)}`;

  async function saveRecord(kind: 'pdf' | 'xlsx') {
    if (monthRows.length === 0) {
      showAlert('Nothing to save', 'There is no work in the last 30 days yet.');
      return;
    }
    setExporting(kind);
    try {
      const title = `${businessName || 'Work record'} — last 30 days`;
      if (kind === 'pdf') {
        await exportWorkPdf(title, `${periodLabel} · ${monthRows.length} jobs`, monthRows);
      } else {
        await exportWorkXlsx(`${fileStem}.xlsx`, 'Work record', monthRows);
      }
    } catch (err) {
      showAlert('Could not save the record', getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const staffChoices: PickPerson[] = useMemo(
    () =>
      employees.map(({ employment, profile }) => ({
        id: profile.id,
        name: profile.full_name,
        photoUrl: profile.avatar_url,
        line: [employment.job_title, `On duty ${employment.work_start_time?.slice(0, 5) ?? '09:00'}–${employment.work_end_time?.slice(0, 5) ?? '17:00'}`]
          .filter(Boolean)
          .join(' · '),
      })),
    [employees]
  );

  async function sendJobTo(person: PickPerson) {
    if (!assigning) return;
    const request = assigning.request;
    // A job already under way is handed over by the server, not just re-offered - and the person who
    // has it is named first, because they lose it (they are told, and the new one has to accept).
    if (request.status === 'in_progress') {
      const current = request.technician_id ? technicianName(request.technician_id) : 'The technician';
      showAlert(
        'Hand this job over?',
        `${current} is working on it. It goes to ${person.name} as a new offer, and ${current} is told it was taken back. What has been recorded so far - parts, labour and chalan - stays on the job.`,
        [
          { text: 'Keep it with them', style: 'cancel' },
          { text: 'Hand over', onPress: () => void deliverJob(request, person, true) },
        ]
      );
      return;
    }
    await deliverJob(request, person, false);
  }

  async function deliverJob(request: ServiceRequest, person: PickPerson, handOver: boolean) {
    setSending(true);
    try {
      if (handOver) {
        // hand_over_job (migration 0099): the job goes back to 'assigned' for the new technician.
        const { error } = await (supabase as any).rpc('hand_over_job', {
          p_request_id: request.id,
          p_technician_id: person.id,
        });
        if (error) throw error;
      } else {
        await assignTechnician({ requestId: request.id, technicianId: person.id });
      }
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      await queryClient.invalidateQueries({ queryKey: ['job_cards'] });
      setAssigning(null);
      showJobSentAlert(person.name);
    } catch (err) {
      showAlert(handOver ? 'Could not hand the job over' : 'Could not send the job', getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function setOpenToTeam(request: ServiceRequest, open: boolean) {
    setBusyId(request.id);
    try {
      await updateRequest.mutateAsync({ id: request.id, values: { open_to_team: open } });
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const smallButton = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, tone: 'blue' | 'ghost') => (
    <Pressable
      onPress={onPress}
      className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg disabled:opacity-50"
      style={
        tone === 'blue'
          ? { backgroundColor: BLUE }
          : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' }
      }
    >
      <Ionicons name={icon} size={15} color={tone === 'blue' ? '#FFFFFF' : '#374151'} />
      <Text className={`text-[12.5px] font-semibold ${tone === 'blue' ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
    </Pressable>
  );

  const emptyNote = (text: string) => <Text className="py-2 text-[12px] text-gray-400">{text}</Text>;

  // A job somebody already carries: the one thing to do from here is hand it to someone else.
  const reassignFooter = (r: ServiceRequest) => (
    <View className="mt-2.5 flex-row" style={{ gap: 8 }}>
      {smallButton('Reassign', 'person-add-outline', () => openPicker(r), 'ghost')}
    </View>
  );

  // While searching, a column with nothing in it is left out, so the match is what is on screen.
  const columns = (
    <>
      {searching && found.length === 0 && emptyNote(`No work matches "${query.trim()}".`)}

      {(!searching || foundUnassigned.length > 0) && (
      <Column
        title="Nobody yet"
        subtitle="Assign someone, or open it to the team"
        count={foundUnassigned.length}
        color="#4B5563"
        tint="#F3F4F6"
        wide={wide}
      >
        {foundUnassigned.length === 0
          ? emptyNote('Every job has someone on it.')
          : foundUnassigned.map((r) => (
              <JobCard
                key={r.id}
                request={r}
                footer={
                  <View className="mt-2.5 flex-row" style={{ gap: 8 }}>
                    {smallButton('Assign', 'person-add-outline', () => openPicker(r), 'blue')}
                    {smallButton(busyId === r.id ? 'Opening…' : 'Open to team', 'megaphone-outline', () => setOpenToTeam(r, true), 'ghost')}
                  </View>
                }
              />
            ))}
      </Column>
      )}

      {(!searching || foundOpenToTeam.length > 0) && (
      <Column
        title="Outsource Technician"
        subtitle="First of your employees to accept gets it"
        count={foundOpenToTeam.length}
        color="#059669"
        tint="#ECFDF5"
        wide={wide}
      >
        {foundOpenToTeam.length === 0
          ? emptyNote('Nothing is waiting to be picked up.')
          : foundOpenToTeam.map((r) => (
              <JobCard
                key={r.id}
                request={r}
                footer={
                  <View className="mt-2.5 flex-row" style={{ gap: 8 }}>
                    {smallButton('Assign instead', 'person-add-outline', () => openPicker(r), 'ghost')}
                    {smallButton(busyId === r.id ? 'Removing…' : 'Take back', 'close-circle-outline', () => setOpenToTeam(r, false), 'ghost')}
                  </View>
                }
              />
            ))}
      </Column>
      )}

      {employees.map(({ employment, profile }) => {
        const jobs = foundWith(profile.id);
        if (searching && jobs.length === 0) return null;
        const spans = workedOn(requests, jobTimes, profile.id, dayStart, now);
        const offers = offeredOn(requests, jobTimes, profile.id, dayStart, now);
        const dutyFrom = minutesOf(employment.work_start_time, 9 * 60);
        const dutyTo = minutesOf(employment.work_end_time, 17 * 60);
        const figures = dayFigures(spans, dutyFrom, dutyTo, elapsedMinutes);
        const dutyText = `On duty ${employment.work_start_time?.slice(0, 5) ?? '09:00'}–${employment.work_end_time?.slice(0, 5) ?? '17:00'}`;
        // Who they are to you: their employee number and their designation ("MTPL-05 · Jr. Technician").
        const designation = [employment.employee_code, employment.job_title].filter(Boolean).join(' · ');
        // What stands on their day: every offer and every stretch of work. Today's open jobs are full cards;
        // on another day, and for finished work, short labels. With a search typed in, only the open jobs
        // it finds.
        const liveIds = new Set(jobs.map((r) => r.id));
        const dayItems: DayItem[] = [
          ...offers.map((o): DayItem => ({ id: `offer:${o.id}`, request: o.request, kind: 'offer', from: o.from, to: o.to, live: isToday && o.waiting, open: o.waiting })),
          ...spans.map((s): DayItem => ({ id: `work:${s.id}`, request: s.request, kind: 'work', from: s.from, to: s.to, live: isToday && s.running, open: s.running })),
        ].filter((item) => (item.live ? liveIds.has(item.request.id) : !searching));
        const placedIds = new Set(dayItems.filter((item) => item.live).map((item) => item.request.id));
        const offPage = isToday ? jobs.filter((r) => !placedIds.has(r.id)) : [];
        return (
          <Column
            key={employment.id}
            title={profile.full_name ?? 'Technician'}
            subtitle={designation || dutyText}
            count={jobs.length}
            color={BLUE}
            tint="#EFF6FF"
            avatar={{ name: profile.full_name, photoUrl: profile.avatar_url }}
            phone={profile.phone}
            headerExtra={
              <View style={{ gap: 1 }}>
                {!!designation && (
                  <Text className="text-[11px] text-gray-600" numberOfLines={1}>
                    {dutyText}
                  </Text>
                )}
                <Text className="text-[11px] font-bold text-gray-900" numberOfLines={1}>
                  {dayLabel}
                </Text>
                <View className="flex-row flex-wrap items-center" style={{ columnGap: 10 }}>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: WORKED_GREEN }} />
                    <Text className="text-[11px] font-semibold text-gray-700">Worked {minutesLabel(figures.worked)}</Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: UNUSED_RED }} />
                    <Text className="text-[11px] font-semibold text-gray-700">Not used {minutesLabel(figures.unused)}</Text>
                  </View>
                  <Text className="text-[11px] text-gray-600">
                    {`${spans.length} job${spans.length === 1 ? '' : 's'}${isToday ? ' today' : ''}${
                      isToday && spans.some((s) => s.running) ? ' · working now' : ''
                    }${isToday && offers.some((o) => o.waiting) ? ` · ${offers.filter((o) => o.waiting).length} waiting to accept` : ''}`}
                  </Text>
                </View>
              </View>
            }
            wide={wide}
          >
            {wide ? (
              <>
                <EmployeeDay
                  items={dayItems}
                  busy={busyIntervals(spans)}
                  dutyFrom={dutyFrom}
                  dutyTo={dutyTo}
                  nowMin={elapsedMinutes}
                  showNow={isToday}
                  renderCard={(r) => <JobCard request={r} compact footer={reassignFooter(r)} />}
                />
                {/* A job of theirs that has no time on the day (no recorded start) is still theirs to see. */}
                {offPage.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text className="text-[11px] font-bold text-gray-500">No time recorded yet</Text>
                    {offPage.map((r) => (
                      <JobCard key={r.id} request={r} footer={reassignFooter(r)} />
                    ))}
                  </View>
                )}
              </>
            ) : jobs.length === 0 ? (
              emptyNote('Free right now.')
            ) : (
              jobs.map((r) => <JobCard key={r.id} request={r} footer={reassignFooter(r)} />)
            )}
          </Column>
        );
      })}

      {outsideHolders.map((id) => {
        const jobs = foundWith(id);
        if (searching && jobs.length === 0) return null;
        const profile = profileById.get(id);
        return (
          <Column
            key={id}
            title={profile?.full_name ?? 'Outside technician'}
            subtitle="Not on your team"
            count={jobs.length}
            color="#6B7280"
            tint="#F3F4F6"
            avatar={{ name: profile?.full_name ?? null, photoUrl: profile?.avatar_url ?? null }}
            phone={profile?.phone}
            wide={wide}
          >
            {jobs.map((r) => (
              <JobCard key={r.id} request={r} footer={reassignFooter(r)} />
            ))}
          </Column>
        );
      })}
    </>
  );

  // On a phone the title and the buttons are stacked: in one row, the five
  // buttons took all the width and squeezed the title to a one-letter column.
  const header = (
    <View className={headerInRow ? 'flex-row items-center gap-2.5' : ''} style={headerInRow ? undefined : { gap: 10 }}>
      <View className={headerInRow ? 'flex-1' : ''}>
        <Text className="text-[15px] font-bold text-gray-900">
          {view === 'sheet'
            ? STAGE_COPY[stage].title(shown.length)
            : searching
              ? `${found.length} of ${live.length} job${live.length === 1 ? '' : 's'} match`
              : `${live.length} job${live.length === 1 ? '' : 's'} in play`}
        </Text>
        <Text className="mt-0.5 text-[12px] text-gray-500">
          {view === 'sheet'
            ? [shownOverdue > 0 && `${shownOverdue} overdue`, openToTeam.length > 0 && `${openToTeam.length} open to the team`]
                .filter(Boolean)
                .join(' · ') || 'Nothing overdue'
            : `${foundUnassigned.length} waiting for someone · ${foundOpenToTeam.length} open to the team${
                foundOverdue > 0 ? ` · ${foundOverdue} overdue` : ''
              }`}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {view === 'sheet' && wide && (
          <Pressable
            onPress={openBoard}
            className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
            accessibilityLabel="Detailed: who is carrying what"
          >
            <Ionicons name="grid-outline" size={15} color="#374151" />
            <Text className="text-[12.5px] font-semibold text-gray-700">Detailed</Text>
          </Pressable>
        )}
        {view === 'sheet' && (
          <Pressable
            onPress={() => setMaximised(true)}
            className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
            accessibilityLabel="Full screen"
          >
            <Ionicons name="expand-outline" size={15} color="#374151" />
            <Text className="text-[12.5px] font-semibold text-gray-700">Full screen</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push(newJobHref() as any)}
          className="h-9 flex-row items-center gap-1.5 rounded-lg px-3"
          style={{ backgroundColor: BLUE }}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text className="text-[12.5px] font-semibold text-white">Add work</Text>
        </Pressable>

        {view === 'sheet' && (
          <>
            <Pressable
              onPress={() => saveRecord('pdf')}
              disabled={!!exporting}
              className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 disabled:opacity-50"
            >
              <Ionicons name="document-text-outline" size={15} color="#B91C1C" />
              <Text className="text-[12.5px] font-semibold text-gray-700">
                {exporting === 'pdf' ? 'Saving…' : 'PDF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => saveRecord('xlsx')}
              disabled={!!exporting}
              className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 disabled:opacity-50"
            >
              <Ionicons name="grid-outline" size={15} color="#047857" />
              <Text className="text-[12.5px] font-semibold text-gray-700">
                {exporting === 'xlsx' ? 'Saving…' : 'Excel'}
              </Text>
            </Pressable>
          </>
        )}

        {view === 'board' && (
          <Pressable
            onPress={closeBoard}
            className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
          >
            <Ionicons name="list-outline" size={15} color="#374151" />
            <Text className="text-[12.5px] font-semibold text-gray-700">Back to list</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push('/(reseller)/employees' as any)}
          className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
        >
          <Ionicons name="people-outline" size={15} color="#374151" />
          <Text className="text-[12.5px] font-semibold text-gray-700">My team</Text>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading && !requests) {
    return (
      <View className="flex-1 bg-gray-50 p-6">
        <Text className="text-sm text-gray-500">Loading…</Text>
      </View>
    );
  }

  const sheet = (
    <>
      <JobList
        jobs={shown}
        times={jobTimes}
        now={now}
        technicianName={technicianName}
        onAssign={assignFromList}
        onCancelWork={confirmCancelWork}
        onDeleteWork={confirmDeleteJob}
        onMarkDone={confirmMarkDone}
        onOpenToTeam={setOpenToTeam}
        busyId={cancellingId ?? deletingId ?? doingId ?? busyId}
        wide={wide}
        dense
        emptyText={STAGE_COPY[stage].empty}
      />
      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        {STAGE_COPY[stage].note} PDF and Excel save the last 30 days in full ({monthRows.length} job
        {monthRows.length === 1 ? '' : 's'}).
      </Text>

      {/* Full screen: the same list with nothing clipped, for long job
          names that the column can only show the start of. */}
      <Modal visible={maximised} animationType="slide" onRequestClose={() => setMaximised(false)}>
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-gray-900">
                {shown.length} job{shown.length === 1 ? '' : 's'}
              </Text>
              <Text className="mt-0.5 text-[11.5px] text-gray-500">Full names, nothing cut short</Text>
            </View>
            <Pressable
              onPress={() => setMaximised(false)}
              className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
            >
              <Ionicons name="contract-outline" size={15} color="#374151" />
              <Text className="text-[12.5px] font-semibold text-gray-700">Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: wide ? 24 : 12, paddingBottom: 40, gap: 12 }}>
            <JobList
              jobs={shown}
              times={jobTimes}
              now={now}
              technicianName={technicianName}
              onAssign={(r) => {
                // The board is another page; this full-screen list is a pop-up over this one.
                setMaximised(false);
                assignFromList(r);
              }}
              onCancelWork={confirmCancelWork}
              onDeleteWork={confirmDeleteJob}
              onMarkDone={confirmMarkDone}
              onOpenToTeam={setOpenToTeam}
              busyId={cancellingId ?? deletingId ?? doingId ?? busyId}
              wide={wide}
              expanded
              dense
              emptyText={STAGE_COPY[stage].empty}
            />
          </ScrollView>
        </View>
      </Modal>

      <Pressable
        onPress={openBoard}
        className="flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5"
      >
        <Ionicons name="grid-outline" size={17} color={BLUE} />
        <Text className="text-[14px] font-semibold" style={{ color: BLUE }}>
          View details
        </Text>
        <Text className="text-[12px] text-gray-500">— who is carrying what</Text>
      </Pressable>
    </>
  );

  return (
    <View style={{ gap: wide ? 16 : 14 }} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      {header}
      {view === 'board' && (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View
            className="h-10 flex-1 flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3"
            style={wide ? { maxWidth: 520 } : undefined}
          >
            <Ionicons name="search" size={16} color="#6B7280" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search work: ticket, customer, phone, job, technician"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search work"
              className="flex-1 text-[13px] text-gray-900"
              style={{ outlineStyle: 'none' } as object}
            />
            {searching && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
          {wide && (
            <View className="ml-auto flex-row items-center" style={{ gap: 6 }}>
              {/* Which day the employees' tables show. The calendar is the app's own (BS or AD). */}
              <DateField
                value={day}
                onChange={(picked) => setPickedDay(picked === today ? null : picked)}
                renderTrigger={(open) => (
                  <Pressable
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel="Pick the day"
                    className="h-10 flex-row items-center gap-2 rounded-lg border border-gray-300 bg-white px-3"
                  >
                    <Ionicons name="calendar-outline" size={16} color="#374151" />
                    <Text className="text-[12.5px] font-semibold text-gray-800">
                      {toBsHistoryLabel(day)}
                      {isToday ? ' · Today' : ''}
                    </Text>
                  </Pressable>
                )}
              />
              {canSlide && <Text className="text-[11.5px] text-gray-500">More columns</Text>}
              {canSlide && ([-1, 1] as const).map((direction) => {
                const disabled = direction === -1 ? slideX <= 4 : slideX + slideView >= slideContent - 4;
                return (
                  <Pressable
                    key={direction}
                    onPress={() => slide(direction)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={direction === -1 ? 'Show columns on the left' : 'Show columns on the right'}
                    className="h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white"
                    style={{ opacity: disabled ? 0.4 : 1 }}
                  >
                    <Ionicons name={direction === -1 ? 'chevron-back' : 'chevron-forward'} size={18} color="#374151" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
      {view === 'sheet' ? (
        sheet
      ) : wide ? (
        // flexGrow/minWidth let the columns (each 320px at least) share any
        // extra room instead of leaving an empty strip on the right.
        <ScrollView
          ref={columnsRef}
          horizontal
          showsHorizontalScrollIndicator
          scrollEventThrottle={16}
          onScroll={(e) => setSlideX(e.nativeEvent.contentOffset.x)}
          onLayout={(e) => setSlideView(e.nativeEvent.layout.width)}
          onContentSizeChange={(width) => setSlideContent(width)}
          contentContainerStyle={{ gap: 14, paddingBottom: 8, flexGrow: 1, minWidth: '100%' }}
        >
          {columns}
        </ScrollView>
      ) : (
        columns
      )}

      {/* On both the list and the board: the board's Assign buttons open it too. */}
      <AssignSheet
        request={assigning?.request ?? null}
        // Not the technician who already has the job - handing it to them would be a no-op.
        people={staffChoices.filter((p) => p.id !== assigning?.request.technician_id)}
        onPick={sendJobTo}
        onClose={() => setAssigning(null)}
        busy={sending}
      />
    </View>
  );
}
