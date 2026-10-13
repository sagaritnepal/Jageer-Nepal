// lib/components/requests/WorkHubPanel.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { JobTimeline } from '../JobTimeline';
import { TicketChip } from '../TicketChip';
import { ticketLabel } from '../../utils/ticket';
import { jobJourney, jobStages, type JobTimes } from '../../utils/jobTimeline';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseUpdate } from '../../hooks/useSupabase';
import { useMyEmployees } from '../../hooks/useTechnicianEmployment';
import { useRankedTechnicians } from '../../hooks/useTechnicianRanking';
import { assignTechnician, showJobSentAlert } from '../../utils/assignTechnician';
import { canCancelWork, useCancelWork } from '../../hooks/useCancelWork';
import { PersonAvatar } from '../PersonAvatar';
import { CategoryBadge } from '../CategoryBadge';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { formatScheduledWhen } from '../../utils/scheduledTime';
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

function JobCard({ request, footer }: { request: ServiceRequest; footer?: React.ReactNode }) {
  const chip = statusChip(request);
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-3">
      <Pressable onPress={() => router.push(`/(reseller)/request/${request.id}` as any)} className="flex-row items-start gap-2.5">
        <CategoryBadge category={request.issue_type} size={30} />
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TicketChip no={request.ticket_no} />
            <Text className="text-[13.5px] font-bold text-gray-900" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
              {request.issue_type}
            </Text>
          </View>
          <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={1}>
            {request.customer_name ?? 'Customer'} · {when(request)}
          </Text>
          <Text className="mt-0.5 text-[11.5px] text-gray-500" numberOfLines={1}>
            {request.location_data?.address ?? 'No address'}
          </Text>
          <View className="mt-1.5 flex-row flex-wrap items-center" style={{ gap: 6 }}>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: chip.bg }}>
              <Text className="text-[10.5px] font-bold" style={{ color: chip.color }}>
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

function Column({
  title,
  subtitle,
  count,
  color,
  tint,
  avatar,
  phone,
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
  children: React.ReactNode;
  wide: boolean;
}) {
  return (
    <View
      className="rounded-2xl border border-gray-200 bg-gray-50"
      style={wide ? { minWidth: 320, flexBasis: 320, flexGrow: 1, flexShrink: 0 } : undefined}
    >
      <View className="flex-row items-center gap-2.5 rounded-t-2xl px-3.5 py-3" style={{ backgroundColor: tint }}>
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

/** Who should do this job. Two lists, because they are two decisions: the
 * people who work for you (pick one, it goes straight to them) and the
 * freelancers nearby (sending one is a request they can turn down). */
function AssignSheet({
  request,
  mode,
  people,
  loading,
  onPick,
  onClose,
  busy,
}: {
  request: ServiceRequest | null;
  mode: 'staff' | 'freelance';
  people: PickPerson[];
  loading: boolean;
  onPick: (person: PickPerson) => void;
  onClose: () => void;
  busy: boolean;
}) {
  if (!request) return null;
  const staff = mode === 'staff';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" onPress={onClose}>
        <Pressable onPress={() => {}} className="w-full overflow-hidden rounded-2xl bg-white" style={{ maxWidth: 420, maxHeight: '85%' }}>
          <View className="flex-row items-center gap-2.5 px-5 py-4" style={{ backgroundColor: staff ? BLUE : '#6D28D9' }}>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-white">
                {staff ? 'Give this to your staff' : 'Request a freelance technician'}
              </Text>
              <Text className="mt-0.5 text-[11.5px] text-white/85" numberOfLines={1}>
                {request.issue_type} · {request.customer_name ?? 'Customer'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView>
            {loading ? (
              <Text className="px-5 py-5 text-sm text-gray-500">Loading…</Text>
            ) : people.length === 0 ? (
              <Text className="px-5 py-5 text-sm text-gray-500">
                {staff
                  ? 'Nobody works for you yet - add your team under My team.'
                  : 'No freelance technician is free right now.'}
              </Text>
            ) : (
              people.map((person, i) => (
                <Pressable
                  key={person.id}
                  onPress={() => !busy && onPick(person)}
                  disabled={busy}
                  className={`flex-row items-center gap-3 px-5 py-3.5 disabled:opacity-60 ${i === people.length - 1 ? '' : 'border-b border-gray-100'}`}
                >
                  <PersonAvatar name={person.name} photoUrl={person.photoUrl} size={36} bg={staff ? 'bg-blue-600' : 'bg-purple-600'} />
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-gray-900" numberOfLines={1}>
                      {person.name ?? 'Technician'}
                    </Text>
                    <Text className="text-[11.5px] text-gray-500" numberOfLines={1}>
                      {person.line}
                    </Text>
                  </View>
                  <Text className="text-[12px] font-semibold" style={{ color: staff ? BLUE : '#6D28D9' }}>
                    {staff ? 'Assign' : 'Request'}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Text className="border-t border-gray-100 px-5 py-3 text-[11px] leading-[16px] text-gray-500">
            {staff
              ? 'It rings on their phone; they accept or reject it.'
              : "A freelancer isn't on your team - they get the same ringing request and can turn it down."}
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

type CardAction = { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'ghost' | 'violet'; onPress: () => void };

const ACTION_TONE = {
  primary: { bg: '#0F766E', border: '#0F766E', fg: '#FFFFFF' },
  ghost: { bg: '#FFFFFF', border: '#D1D5DB', fg: '#374151' },
  violet: { bg: '#FFFFFF', border: '#DDD6FE', fg: '#6D28D9' },
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
  onRequest,
  onCancelWork,
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
  onRequest: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
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
  actions.push({ label: 'Request Outsource', icon: 'paper-plane-outline', tone: 'violet', onPress: () => onRequest(r) });

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
        {canCancelWork(r) ? (
          <Pressable
            onPress={() => onCancelWork(r)}
            disabled={busy}
            accessibilityLabel="Cancel job"
            className="h-11 flex-row items-center justify-center gap-2 rounded-lg px-3 disabled:opacity-50"
            style={roomy ? undefined : { flexGrow: 1, flexBasis: 120 }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#B91C1C" />
            <Text className="text-[14px] font-semibold" style={{ color: '#B91C1C' }}>
              Cancel job
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
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
                    borderColor: a.tone === 'violet' ? '#A78BFA' : tone.border,
                    ...(roomy ? null : { flexGrow: 1, flexBasis: 120 }),
                  }}
                >
                  <Ionicons name={a.icon} size={18} color={a.tone === 'violet' ? '#5B21B6' : tone.fg} />
                  <Text className="text-[14px] font-semibold" style={{ color: a.tone === 'violet' ? '#5B21B6' : tone.fg }}>
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

/** The column names above the compact rows - the same widths as the cells under them. */
function JobCompactHeader() {
  const head = 'text-[11px] font-bold capitalize tracking-wide text-gray-500';
  const grow = (g: number) => ({ flexBasis: 0, flexGrow: g, minWidth: 0 }) as const;
  return (
    <View className="flex-row items-center rounded-lg px-4 py-2" style={{ gap: 14, backgroundColor: '#F3F4F6' }}>
      <Text className={head} style={{ width: 84 }}>
        Token no.
      </Text>
      <Text className={head} style={{ width: 150 }}>
        Date &amp; time
      </Text>
      <Text className={head} style={grow(1.5)}>
        Job
      </Text>
      <Text className={head} style={grow(1.1)}>
        Customer
      </Text>
      <Text className={head} style={grow(1)}>
        Address
      </Text>
      <Text className={`${head} text-right`} style={{ width: 104 }}>
        Amount
      </Text>
      <Text className={head} style={{ width: 130 }}>
        Technician
      </Text>
      <Text className={head} style={{ width: 250 }}>
        Progress
      </Text>
      <Text className={`${head} text-right`} style={{ width: 176 }}>
        Actions
      </Text>
    </View>
  );
}

/** One job on one short row, so a whole page of work fits on the screen at once: what and who,
 * where and when, the technician, the amount, how far along it is, and the actions as buttons. */
function JobCompactRow({
  request: r,
  times,
  now,
  technicianName,
  onAssign,
  onRequest,
  onCancelWork,
  onOpenToTeam,
  busy,
}: {
  request: ServiceRequest;
  times: JobTimes | undefined;
  now: number;
  technicianName: (id: string) => string;
  onAssign: (request: ServiceRequest) => void;
  onRequest: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
  onOpenToTeam: (request: ServiceRequest, open: boolean) => void;
  busy: boolean;
}) {
  const open = () => router.push(`/(reseller)/request/${r.id}` as any);
  const chip = r.status === 'in_progress' ? { label: 'Working on it', color: '#166534', bg: '#DCFCE7' } : statusChip(r);
  const pay = PAY_CHIP[r.payment_status] ?? PAY_CHIP.unpaid;
  const hold = r.hold_status === 'requested' ? HOLD_CHIP.requested : r.hold_status === 'on_hold' ? HOLD_CHIP.on_hold : null;
  const issue = splitIssue(r.issue_type);
  const scheduled = formatScheduledWhen(r.scheduled_date, r.scheduled_time);
  const overdue = isOverdue(r);
  const { nodes, legs } = jobJourney(r, times, now);
  let current = -1;
  nodes.forEach((n, i) => {
    if (n.reached) current = i;
  });
  const finished = nodes[nodes.length - 1].reached;
  const step = finished ? nodes.length : current + 1;
  const live = current >= 0 && !finished ? legs[current] : undefined;

  // The one action that moves the job on, then Request Outsource; a hold waiting on you comes first.
  const mainLabel = r.hold_status === 'requested' ? 'Review hold' : r.technician_id ? 'Reassign' : 'Assign';
  const mainIcon: keyof typeof Ionicons.glyphMap = r.hold_status === 'requested' ? 'pause-circle-outline' : 'person-add-outline';
  const mainPress = r.hold_status === 'requested' ? open : () => onAssign(r);

  const cell = { minWidth: 0 } as const;
  const stages = jobStages(r, times);
  const statusLine = [chip.label, hold?.label, overdue ? `Overdue by ${overdueBy(r)}` : null, pay.label].filter(Boolean).join(' · ');
  return (
    <View
      className="flex-row items-center rounded-xl bg-white px-4 py-3"
      style={{ gap: 14, borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <Text className="text-[12.5px] font-bold text-gray-800" style={{ width: 84 }} numberOfLines={1}>
        {ticketLabel(r.ticket_no) ?? '—'}
      </Text>

      <View style={{ width: 150, ...cell }}>
        <Text className="text-[12.5px] text-gray-800" numberOfLines={2}>
          {scheduled ?? 'Not scheduled'}
        </Text>
      </View>

      <Pressable onPress={open} className="flex-row items-center" style={{ gap: 10, flexBasis: 0, flexGrow: 1.5, ...cell }}>
        <CategoryBadge category={r.issue_type} size={34} />
        <View style={{ flex: 1, gap: 2, ...cell }}>
          {!!issue.eyebrow && (
            <Text className="text-[11px] font-semibold text-gray-500" numberOfLines={1}>
              {issue.eyebrow}
            </Text>
          )}
          <Text className="text-[14px] font-bold text-gray-900" numberOfLines={1}>
            {issue.title}
          </Text>
        </View>
      </Pressable>

      <View style={{ flexBasis: 0, flexGrow: 1.1, ...cell }}>
        <Text className="text-[13px] font-semibold text-gray-900" numberOfLines={1}>
          {r.customer_name ?? 'Customer'}
        </Text>
        {!!r.customer_phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${r.customer_phone}`)} className="self-start">
            <Text className="text-[12px] font-medium" style={{ color: '#0F766E' }} numberOfLines={1}>
              {r.customer_phone}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexBasis: 0, flexGrow: 1, ...cell }}>
        <Text className="text-[13px] text-gray-800" numberOfLines={2}>
          {r.location_data?.address ?? 'No address'}
        </Text>
      </View>

      <Text className="text-right text-[14px] font-extrabold text-gray-900" style={{ width: 104 }}>
        {money(r.quoted_price)}
      </Text>

      <View className="flex-row items-center" style={{ width: 130, gap: 8, ...cell }}>
        {r.technician_id ? (
          <>
            <View className="items-center justify-center rounded-full" style={{ width: 26, height: 26, backgroundColor: '#374151' }}>
              <Text className="text-[10.5px] font-bold text-white">{initialsOf(technicianName(r.technician_id))}</Text>
            </View>
            <Text className="flex-1 text-[12.5px] font-semibold text-gray-900" numberOfLines={1}>
              {technicianName(r.technician_id)}
            </Text>
          </>
        ) : (
          <Text className="text-[12.5px] font-semibold" style={{ color: r.open_to_team ? '#047857' : '#4B5563' }}>
            {r.open_to_team ? 'Open to the team' : 'Nobody yet'}
          </Text>
        )}
      </View>

      {/* Assigned / WIP / Hold / Completed, with the words above their bars. */}
      <View style={{ width: 250, gap: 4 }}>
        <View className="flex-row" style={{ gap: 6 }}>
          {stages.map((step) => {
            const color = step.state === 'current' ? '#15803D' : step.state === 'done' ? '#374151' : '#9CA3AF';
            return (
              <View key={step.label} style={{ flex: 1, gap: 4 }}>
                <Text className="text-[10.5px] font-semibold" style={{ color }} numberOfLines={1}>
                  {step.label}
                </Text>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: step.state === 'current' ? '#16A34A' : step.state === 'done' ? '#4B5563' : '#E5E7EB',
                  }}
                />
              </View>
            );
          })}
        </View>
        <Text className="text-[11px] text-gray-600" numberOfLines={1}>
          {statusLine}
        </Text>
      </View>

      <View className="flex-row items-center justify-end" style={{ gap: 6, width: 176 }}>
        <Pressable
          onPress={mainPress}
          disabled={busy}
          accessibilityLabel={mainLabel}
          className="h-9 flex-row items-center justify-center gap-1.5 rounded-lg px-3 disabled:opacity-50"
          style={{ backgroundColor: '#0F766E' }}
        >
          <Ionicons name={mainIcon} size={15} color="#FFFFFF" />
          <Text className="text-[12.5px] font-semibold text-white">{mainLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => onRequest(r)}
          disabled={busy}
          accessibilityLabel="Request Outsource"
          className="h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
          style={{ borderWidth: 1, borderColor: '#A78BFA' }}
        >
          <Ionicons name="paper-plane-outline" size={16} color="#5B21B6" />
        </Pressable>
        {canCancelWork(r) && (
          <Pressable
            onPress={() => onCancelWork(r)}
            disabled={busy}
            accessibilityLabel="Cancel job"
            className="h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
            style={{ borderWidth: 1, borderColor: '#FECACA' }}
          >
            <Ionicons name="close-circle-outline" size={17} color="#B91C1C" />
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
  onRequest,
  onCancelWork,
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
  onRequest: (request: ServiceRequest) => void;
  onCancelWork: (request: ServiceRequest) => void;
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
  // The row needs the room of a table: below this the stacked card reads better.
  const compact = !!dense && wide && boxWidth >= 1000;

  if (jobs.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
        <Ionicons name="clipboard-outline" size={26} color="#D1D5DB" />
        <Text className="mt-2 text-sm text-gray-500">{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: compact ? 8 : 12 }} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      {compact && <JobCompactHeader />}
      {jobs.map((r) =>
        compact ? (
          <JobCompactRow
            key={r.id}
            request={r}
            times={times?.get(r.id)}
            now={now}
            technicianName={technicianName}
            onAssign={onAssign}
            onRequest={onRequest}
            onCancelWork={onCancelWork}
            onOpenToTeam={onOpenToTeam}
            busy={busyId === r.id}
          />
        ) : (
        <JobRowCard
          key={r.id}
          request={r}
          times={times?.get(r.id)}
          now={now}
          technicianName={technicianName}
          onAssign={onAssign}
          onRequest={onRequest}
          onCancelWork={onCancelWork}
          onOpenToTeam={onOpenToTeam}
          busy={busyId === r.id}
          roomy={roomy}
          expanded={expanded}
        />
        )
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
}: {
  wide: boolean;
  stage: keyof typeof STAGE_COPY;
  /** This stage's jobs. */
  jobs: ServiceRequest[];
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const businessName = useAuthStore((state) => state.profile?.business_name);
  const queryClient = useQueryClient();
  const updateRequest = useSupabaseUpdate('service_requests');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirmCancelWork, busyId: cancellingId } = useCancelWork();
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [assigning, setAssigning] = useState<{ request: ServiceRequest; mode: 'staff' | 'freelance' } | null>(null);
  const [sending, setSending] = useState(false);
  const [maximised, setMaximised] = useState(false);
  // One short row per job (default on a wide screen) so many jobs fit at once; off shows the full cards.
  const [dense, setDense] = useState(true);
  // The sheet answers "what is on today"; the board answers "who is
  // carrying it". Opening on the lighter of the two.
  const [view, setView] = useState<'sheet' | 'board'>('sheet');
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
  const now = useNow();
  const { data: employees } = useMyEmployees(userId);
  // Freelancers are ranked by the same rules the job page uses - nearest
  // and free first, and never someone else's employee while on duty.
  const { rankedTechnicians, isLoading: loadingTechnicians } = useRankedTechnicians(
    assigning?.request.location_data,
    userId
  );

  // A job keeps its own copy of the customer's name; when it is linked to a saved customer, the
  // Ledger's current name wins, so renaming someone in the Ledger shows here straight away.
  const { data: savedCustomers } = useSupabaseQuery('customers', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const withLedgerName = useMemo(() => {
    const names = new Map((savedCustomers ?? []).map((c) => [c.id, c.name]));
    return (r: ServiceRequest): ServiceRequest => {
      const name = r.customer_id ? names.get(r.customer_id) : undefined;
      return name && name !== r.customer_name ? { ...r, customer_name: name } : r;
    };
  }, [savedCustomers]);

  // The list is this stage's jobs: overdue ones first, then by when they were due.
  const shown = useMemo(
    () => jobs.map(withLedgerName).sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || dueAt(a) - dueAt(b)),
    [jobs, withLedgerName]
  );
  const shownOverdue = shown.filter(isOverdue).length;

  // The board is about who is carrying work right now - all of it, not just
  // the jobs the list shows.
  const live = useMemo(
    () => requests.filter((r) => LIVE_STATUSES.includes(r.status)).map(withLedgerName),
    [requests, withLedgerName]
  );
  const overdueCount = useMemo(() => live.filter(isOverdue).length, [live]);

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

  const freelanceChoices: PickPerson[] = useMemo(
    () =>
      rankedTechnicians
        .filter((t) => !t.isYourEmployee)
        .map((t) => ({
          id: t.id,
          name: t.full_name,
          photoUrl: t.avatar_url,
          line: [
            t.distance != null ? `${t.distance.toFixed(1)} km away` : t.city ?? 'Location unknown',
            t.is_available ? 'Free now' : 'Busy',
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    [rankedTechnicians]
  );

  async function sendJobTo(person: PickPerson) {
    if (!assigning) return;
    setSending(true);
    try {
      await assignTechnician({ requestId: assigning.request.id, technicianId: person.id });
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      setAssigning(null);
      showJobSentAlert(person.name);
    } catch (err) {
      showAlert('Could not send the job', getErrorMessage(err));
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

  const columns = (
    <>
      <Column
        title="Nobody yet"
        subtitle="Assign someone, or open it to the team"
        count={unassigned.length}
        color="#4B5563"
        tint="#F3F4F6"
        wide={wide}
      >
        {unassigned.length === 0
          ? emptyNote('Every job has someone on it.')
          : unassigned.map((r) => (
              <JobCard
                key={r.id}
                request={r}
                footer={
                  <View className="mt-2.5 flex-row" style={{ gap: 8 }}>
                    {smallButton('Assign', 'person-add-outline', () => setAssigning({ request: r, mode: 'staff' }), 'blue')}
                    {smallButton(busyId === r.id ? 'Opening…' : 'Open to team', 'megaphone-outline', () => setOpenToTeam(r, true), 'ghost')}
                  </View>
                }
              />
            ))}
      </Column>

      <Column
        title="Open to the team"
        subtitle="First of your employees to accept gets it"
        count={openToTeam.length}
        color="#059669"
        tint="#ECFDF5"
        wide={wide}
      >
        {openToTeam.length === 0
          ? emptyNote('Nothing is waiting to be picked up.')
          : openToTeam.map((r) => (
              <JobCard
                key={r.id}
                request={r}
                footer={
                  <View className="mt-2.5 flex-row" style={{ gap: 8 }}>
                    {smallButton('Assign instead', 'person-add-outline', () => setAssigning({ request: r, mode: 'staff' }), 'ghost')}
                    {smallButton(busyId === r.id ? 'Removing…' : 'Take back', 'close-circle-outline', () => setOpenToTeam(r, false), 'ghost')}
                  </View>
                }
              />
            ))}
      </Column>

      {employees.map(({ employment, profile }) => {
        const jobs = byTechnician.get(profile.id) ?? [];
        return (
          <Column
            key={employment.id}
            title={profile.full_name ?? 'Technician'}
            subtitle={
              employment.job_title ??
              `On duty ${employment.work_start_time?.slice(0, 5) ?? '09:00'}–${employment.work_end_time?.slice(0, 5) ?? '17:00'}`
            }
            count={jobs.length}
            color={BLUE}
            tint="#EFF6FF"
            avatar={{ name: profile.full_name, photoUrl: profile.avatar_url }}
            phone={profile.phone}
            wide={wide}
          >
            {jobs.length === 0 ? emptyNote('Free right now.') : jobs.map((r) => <JobCard key={r.id} request={r} />)}
          </Column>
        );
      })}

      {outsideHolders.map((id) => {
        const jobs = byTechnician.get(id) ?? [];
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
              <JobCard key={r.id} request={r} />
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
            : `${live.length} job${live.length === 1 ? '' : 's'} in play`}
        </Text>
        <Text className="mt-0.5 text-[12px] text-gray-500">
          {view === 'sheet'
            ? [shownOverdue > 0 && `${shownOverdue} overdue`, openToTeam.length > 0 && `${openToTeam.length} open to the team`]
                .filter(Boolean)
                .join(' · ') || 'Nothing overdue'
            : `${unassigned.length} waiting for someone · ${openToTeam.length} open to the team${
                overdueCount > 0 ? ` · ${overdueCount} overdue` : ''
              }`}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {view === 'sheet' && wide && (
          <Pressable
            onPress={() => setDense((v) => !v)}
            className="h-9 flex-row items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3"
            accessibilityLabel={dense ? 'Show detailed cards' : 'Show compact rows'}
          >
            <Ionicons name={dense ? 'albums-outline' : 'reorder-three-outline'} size={15} color="#374151" />
            <Text className="text-[12.5px] font-semibold text-gray-700">{dense ? 'Detailed' : 'Compact'}</Text>
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
          onPress={() => router.push('/(reseller)/new-request?from=requests' as any)}
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
            onPress={() => setView('sheet')}
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
        onAssign={(r) => setAssigning({ request: r, mode: 'staff' })}
        onRequest={(r) => setAssigning({ request: r, mode: 'freelance' })}
        onCancelWork={confirmCancelWork}
        onOpenToTeam={setOpenToTeam}
        busyId={cancellingId ?? busyId}
        wide={wide}
        dense={dense}
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
              onAssign={(r) => setAssigning({ request: r, mode: 'staff' })}
              onRequest={(r) => setAssigning({ request: r, mode: 'freelance' })}
              onCancelWork={confirmCancelWork}
              onOpenToTeam={setOpenToTeam}
              busyId={cancellingId ?? busyId}
              wide={wide}
              expanded
              dense={dense}
              emptyText={STAGE_COPY[stage].empty}
            />
          </ScrollView>
        </View>
      </Modal>

      <AssignSheet
        request={assigning?.request ?? null}
        mode={assigning?.mode ?? 'staff'}
        people={assigning?.mode === 'freelance' ? freelanceChoices : staffChoices}
        loading={assigning?.mode === 'freelance' && loadingTechnicians}
        onPick={sendJobTo}
        onClose={() => setAssigning(null)}
        busy={sending}
      />

      <Pressable
        onPress={() => setView('board')}
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
      {view === 'sheet' ? (
        sheet
      ) : wide ? (
        // flexGrow/minWidth let the columns (each 320px at least) share any
        // extra room instead of leaving an empty strip on the right.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ gap: 14, paddingBottom: 8, flexGrow: 1, minWidth: '100%' }}
        >
          {columns}
        </ScrollView>
      ) : (
        columns
      )}
    </View>
  );
}
