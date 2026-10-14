// app/(reseller)/requests.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Modal, FlatList, ScrollView, Pressable, Platform, Linking, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow, subscribeToTable } from '../../lib/hooks/useSupabase';
import { canCancelWork, useCancelWork } from '../../lib/hooks/useCancelWork';
import { distanceKm } from '../../lib/utils/distance';
import { formatScheduledWhen } from '../../lib/utils/scheduledTime';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { WorkHubPanel } from '../../lib/components/requests/WorkHubPanel';
import { STATUS_ACTION_LABEL } from '../../lib/utils/orderStatus';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { ticketLabel } from '../../lib/utils/ticket';
import { jobStages, type StageStepState } from '../../lib/utils/jobTimeline';
import { useRequestsStageStore } from '../../lib/hooks/useRequestsStage';
import type { BusinessTransaction, JobCard, Order, Product, ServiceRequest } from '../../types/database.types';

// "My Jobs" mixed every status (and payment state) into one flat list, so it
// was hard to tell what actually needed attention. Group by pipeline stage
// instead - what the reseller should be doing right now for that job. There
// used to be a separate "Needs your action" stage covering both "claimed,
// still needs a quote" and "approved, needs a technician" - the former now
// folds into "Waiting on customer" (the next step there is just to call the
// customer and send a quote), and the latter is its own "My Jobs" stage,
// right before "Job in progress" since picking a technician is the last
// thing standing between an approved job and it actually starting.
type Stage =
  | 'requests'
  | 'waiting_customer'
  | 'my_jobs'
  | 'in_progress'
  | 'completed'
  | 'awaiting_payment'
  | 'paid'
  | 'cancelled';

/** The page behind the cards - plain white, with the job cards in warm cream on it. */
const PAGE_BG = '#FFFFFF';

const STAGE_ORDER: Stage[] = [
  'requests',
  'my_jobs',
  'completed',
  'awaiting_payment',
  'paid',
  'cancelled',
];
// The numbered pipeline is the job itself, finishing at Completed. What
// happens to the money after that - part paid, settled - sits in the row
// of chips underneath, where Cancelled already lived.
const WORKING_STAGES: Stage[] = ['requests', 'my_jobs', 'completed'];
const SIDE_STAGES: Stage[] = ['awaiting_payment', 'paid', 'cancelled'];

const STAGE_META: Record<
  Stage,
  { label: string; todo: string; icon: keyof typeof Ionicons.glyphMap; color: string; tint: string }
> = {
  requests: { label: 'Customer App Jobs', todo: 'Accept, quote and wait for approval', icon: 'download-outline', color: '#EA580C', tint: '#FFF7ED' },
  waiting_customer: { label: 'Waiting on customer', todo: 'Quote & wait for approval', icon: 'time-outline', color: '#D97706', tint: '#FFFBEB' },
  my_jobs: { label: 'My Jobs', todo: 'Assign a technician and follow the work', icon: 'briefcase', color: '#2563EB', tint: '#EFF6FF' },
  in_progress: { label: 'Job in progress', todo: 'Technician is working', icon: 'build', color: '#2563EB', tint: '#EFF6FF' },
  completed: { label: 'Completed', todo: 'Work done - collect payment', icon: 'checkmark-circle', color: '#16A34A', tint: '#F0FDF4' },
  awaiting_payment: { label: 'Awaiting payment', todo: 'Part paid - collect the rest', icon: 'cash-outline', color: '#DC2626', tint: '#FEF2F2' },
  paid: { label: 'Paid', todo: 'Paid & delivered', icon: 'checkmark-done-circle', color: '#047857', tint: '#ECFDF5' },
  cancelled: { label: 'Cancelled', todo: 'Nothing left to do', icon: 'close-circle', color: '#9CA3AF', tint: '#F3F4F6' },
};

function stageOf(item: ServiceRequest, billedJobs?: Set<string>): Stage {
  switch (item.status) {
    case 'cancelled':
      return 'cancelled';
    case 'pending':
      // A self-sourced (reseller-posted) job skips the quote/approval
      // conversation entirely - SelfSourcedAssign lets the reseller pick a
      // technician immediately, so it lands directly in "My Jobs".
      return item.origin === 'reseller' ? 'my_jobs' : 'requests';
    case 'quoted':
      return 'requests';
    case 'approved':
      return 'my_jobs';
    case 'assigned':
    case 'in_progress':
      // Jobs a technician has been given sit in the same tab as the ones still
      // waiting for one - "My Jobs" is every job being worked, start to finish.
      return 'my_jobs';
    case 'resolved':
      // Finished and settled leaves the pipeline; part paid is the one
      // still worth chasing; anything else is simply done but unpaid.
      if (item.payment_status === 'paid') return 'paid';
      // Once a bill has been created for the job it waits for the money.
      if (item.payment_status === 'partial' || billedJobs?.has(item.id)) return 'awaiting_payment';
      return 'completed';
  }
}

// A pending order hasn't been looked at yet (same as an unclaimed request);
// a confirmed one still needs delivering; shipped is under way; delivered
// means there's nothing left to do.
function orderStageOf(order: Order): Stage {
  switch (order.status) {
    case 'pending':
      return 'requests';
    case 'confirmed':
      return 'my_jobs';
    case 'shipped':
      return 'my_jobs';
    case 'delivered':
      return 'paid';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'requests';
  }
}

type JobItem =
  | { kind: 'request'; id: string; request: ServiceRequest }
  | { kind: 'order'; id: string; order: Order }
  | { kind: 'sale'; id: string; sale: BusinessTransaction; stage: Stage };

type JobAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary: boolean;
  onPress: () => void;
};

type Tag = { label: string; bg: string; fg: string };

const TAGS = {
  app: { label: 'App customer', bg: '#EFF6FF', fg: '#1D4ED8' },
  own: { label: 'Your customer', bg: '#F5F3FF', fg: '#6D28D9' },
  order: { label: 'Shop order', bg: '#ECFDF5', fg: '#047857' },
  unpaid: { label: 'Unpaid', bg: '#FEF2F2', fg: '#DC2626' },
  paid: { label: 'Paid', bg: '#F0FDF4', fg: '#15803D' },
  holdRequested: { label: 'Hold requested', bg: '#FFFBEB', fg: '#92400E' },
  onHold: { label: 'On hold', bg: '#FFFBEB', fg: '#92400E' },
} satisfies Record<string, Tag>;

type JobRowData = {
  icon: ReactNode;
  title: string;
  who: string;
  place: string | null;
  when: string | null;
  /** Extra short lines under the name - a finished job's token, chalan, products and installation. */
  lines?: string[];
  /** Customer's phone, under their name in the table. */
  customerPhone?: string | null;
  /** The technician's name; the table shows a dash when there is none. */
  technician?: string | null;
  /** The chalan number of a finished job, with the way to enter or fix it by hand. */
  chalan?: { no: string | null; onEdit: () => void };
  /** A tick box on the row, to bill several completed jobs of one customer together. */
  select?: { checked: boolean; onToggle: () => void };
  /** The job's token number, shown in its own column. */
  token?: string | null;
  /** Assigned / WIP / Hold / Completed, drawn as four labelled segments. */
  progress?: { label: string; state: StageStepState }[];
  tag: Tag;
  amount: number | null;
  action: JobAction;
  open: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
};

// Web table columns - the same ones My Jobs uses (see JobCompactRow in WorkHubPanel), shared by
// the header row and every job row of every tab.
//
// The table is only as wide as the window leaves it (the side panel takes 240px), and nine columns
// need about 1750px to read well - on a laptop the Job and Customer columns were squeezed to a few
// letters and wrapped on top of each other. So it comes in three sizes, picked from the width the
// table actually has (see tierFor), and below that the jobs are cards, as on a phone:
//   full     every column;
//   compact  the Address goes under the customer;
//   tight    the date goes under the job and the technician under the customer as well.
type Tier = 'full' | 'compact' | 'tight';
type ColKey = 'token' | 'when' | 'job' | 'customer' | 'where' | 'amount' | 'tech' | 'status' | 'actions';

const TIER_COLUMNS: Record<Tier, ColKey[]> = {
  full: ['token', 'when', 'job', 'customer', 'where', 'amount', 'tech', 'status', 'actions'],
  compact: ['token', 'when', 'job', 'customer', 'amount', 'tech', 'status', 'actions'],
  tight: ['token', 'job', 'customer', 'amount', 'status', 'actions'],
};
/** Fixed widths; the columns without one (job, customer, where) share what is left, by TIER_GROW. */
const TIER_WIDTH: Record<Tier, Partial<Record<ColKey, number>>> = {
  full: { token: 84, when: 150, amount: 104, tech: 130, status: 250, actions: 176 },
  compact: { token: 84, when: 140, amount: 104, tech: 120, status: 210, actions: 180 },
  tight: { token: 78, amount: 100, status: 200, actions: 190 },
};
const TIER_GROW: Record<Tier, { job: number; customer: number; where: number }> = {
  full: { job: 2, customer: 1.2, where: 1 },
  compact: { job: 2, customer: 1.4, where: 1 },
  tight: { job: 1.8, customer: 1.2, where: 1 },
};
const TIER_GAP: Record<Tier, number> = { full: 14, compact: 12, tight: 12 };
const HEAD_LABEL: Record<ColKey, string> = {
  token: 'Token no.',
  when: 'Date & time',
  job: 'Job',
  customer: 'Customer',
  where: 'Address',
  amount: 'Amount',
  tech: 'Technician',
  status: 'Progress',
  actions: 'Actions',
};

/** The table's width (px) from which each size reads well; narrower than the last is cards. */
const FULL_TABLE_WIDTH = 1750;
const COMPACT_TABLE_WIDTH = 1400;
const MIN_TABLE_WIDTH = 1100;
function tierFor(width: number): Tier {
  return width >= FULL_TABLE_WIDTH ? 'full' : width >= COMPACT_TABLE_WIDTH ? 'compact' : 'tight';
}

/** The size the table is drawn at, for the header row and every job row to agree on. */
const TierContext = createContext<Tier>('full');

function formatAmount(amount: number | null): string {
  return amount != null ? `NPR ${Number(amount).toLocaleString()}` : '';
}

function ActionButton({ action, color, height }: { action: JobAction; color: string; height: number }) {
  return (
    <Pressable
      onPress={action.onPress}
      className="flex-row items-center justify-center gap-1.5 rounded-lg"
      style={{
        height,
        paddingHorizontal: 12,
        backgroundColor: action.primary ? color : '#FFFFFF',
        borderWidth: action.primary ? 0 : 1,
        borderColor: '#D1D5DB',
      }}
    >
      <Ionicons name={action.icon} size={15} color={action.primary ? '#FFFFFF' : '#374151'} />
      <Text className={`font-semibold ${action.primary ? 'text-white' : 'text-gray-700'}`} style={{ fontSize: height >= 44 ? 14.5 : 13 }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: tag.bg }}>
      <Text className="text-[11px] font-semibold" style={{ color: tag.fg }}>
        {tag.label}
      </Text>
    </View>
  );
}

function ManageButtons({ data }: { data: JobRowData }) {
  if (!data.onEdit && !data.onDelete) return null;
  return (
    <View className="flex-row gap-1">
      {data.onEdit && (
        <Pressable onPress={data.onEdit} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-lg">
          <Ionicons name="create-outline" size={17} color="#6B7280" />
        </Pressable>
      )}
      {data.onDelete && (
        <Pressable
          onPress={data.onDelete}
          disabled={data.deleting}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Cancel work"
          className="h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
        >
          <Ionicons name="close-circle-outline" size={19} color="#DC2626" />
        </Pressable>
      )}
    </View>
  );
}

/** Assigned / WIP / Hold / Completed as four short bars with their words above: the step the job is
 * on is dark green, finished ones dark grey, the rest light. */
function ProgressFour({ steps }: { steps: { label: string; state: StageStepState }[] }) {
  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {steps.map((step) => {
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
  );
}

/** One job, rendered either as a table row (wide web) or a card (phone). */
function JobRowView({ data, stage, wide }: { data: JobRowData; stage: Stage; wide: boolean }) {
  const tier = useContext(TierContext);
  // One brand blue for every job's button, whatever stage it is in.
  const color = '#2563EB';

  if (wide) {
    const cell = { minWidth: 0 } as const;
    const has = (key: ColKey) => TIER_COLUMNS[tier].includes(key);
    const w = TIER_WIDTH[tier];
    const grow = TIER_GROW[tier];
    return (
      <View className="flex-row items-center rounded-xl bg-white px-4 py-3" style={{ gap: TIER_GAP[tier], borderWidth: 1, borderColor: '#E5E7EB' }}>
        {data.select && (
          <Pressable
            onPress={data.select.onToggle}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: data.select.checked }}
            accessibilityLabel="Select for one bill"
            style={{ width: 20 }}
          >
            <Ionicons name={data.select.checked ? 'checkbox' : 'square-outline'} size={20} color={data.select.checked ? '#0F766E' : '#9CA3AF'} />
          </Pressable>
        )}
        <Text className="text-[12.5px] font-bold text-gray-800" style={{ width: w.token }} numberOfLines={1}>
          {data.token ?? '—'}
        </Text>

        {has('when') && (
          <View style={{ width: w.when, ...cell }}>
            <Text className="text-[12.5px] text-gray-800" numberOfLines={2}>
              {data.when ?? '—'}
            </Text>
          </View>
        )}

        <Pressable onPress={data.open} className="flex-row items-center" style={{ gap: 10, flexBasis: 0, flexGrow: grow.job, ...cell }}>
          {data.icon}
          <View style={{ flex: 1, gap: 2, ...cell }}>
            <Text className="text-[14px] font-bold text-gray-900" numberOfLines={2}>
              {data.title}
            </Text>
            {data.chalan && (
              <Pressable onPress={data.chalan.onEdit} hitSlop={4} className="flex-row items-center self-start" style={{ gap: 4 }}>
                <Text className="text-[12px] font-semibold" style={{ color: data.chalan.no ? '#374151' : '#0F766E' }}>
                  {data.chalan.no ? `Chalan no. ${data.chalan.no}` : 'Add chalan no.'}
                </Text>
                <Ionicons name="create-outline" size={12} color="#6B7280" />
              </Pressable>
            )}
            {data.lines?.map((line) => (
              <Text key={line} className="text-[12px] text-gray-600" numberOfLines={2}>
                {line}
              </Text>
            ))}
            {/* The tight table has no Date column: it is under the job. */}
            {!has('when') && !!data.when && (
              <Text className="text-[12px] text-gray-500" numberOfLines={1}>
                {data.when}
              </Text>
            )}
          </View>
        </Pressable>

        <View style={{ flexBasis: 0, flexGrow: grow.customer, ...cell }}>
          <Text className="text-[13px] font-semibold text-gray-900" numberOfLines={1}>
            {data.who}
          </Text>
          {!!data.customerPhone && (
            <Text className="text-[12px] font-medium" style={{ color: '#0F766E' }} numberOfLines={1}>
              {data.customerPhone}
            </Text>
          )}
          {/* A narrower table has no Address / Technician column: they are under the customer. */}
          {!has('where') && !!data.place && (
            <Text className="text-[12px] text-gray-600" numberOfLines={2}>
              {data.place}
            </Text>
          )}
          {!has('tech') && !!data.technician && (
            <Text className="text-[12px] text-gray-500" numberOfLines={1}>
              {`Technician: ${data.technician}`}
            </Text>
          )}
        </View>

        {has('where') && (
          <View style={{ flexBasis: 0, flexGrow: grow.where, ...cell }}>
            <Text className="text-[13px] text-gray-800" numberOfLines={2}>
              {data.place ?? '—'}
            </Text>
          </View>
        )}

        <Text className="text-right text-[14px] font-extrabold text-gray-900" style={{ width: w.amount }} numberOfLines={1}>
          {formatAmount(data.amount) || '—'}
        </Text>

        {has('tech') && (
          <View style={{ width: w.tech, ...cell }}>
            <Text className="text-[12.5px] font-semibold text-gray-900" numberOfLines={1}>
              {data.technician ?? '—'}
            </Text>
          </View>
        )}

        <View style={{ width: w.status }}>
          {data.progress ? (
            <ProgressFour steps={data.progress} />
          ) : (
            <Text className="text-[12px] font-semibold text-gray-700" numberOfLines={1}>
              {data.tag.label}
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-end" style={{ width: w.actions, gap: 6 }}>
          <ActionButton action={data.action} color="#0F766E" height={36} />
          <ManageButtons data={data} />
        </View>
      </View>
    );
  }

  const meta = [data.place, data.when].filter(Boolean).join(' · ');
  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-3.5" style={{ gap: 12 }}>
      <Pressable onPress={data.open} className="flex-row items-start gap-3">
        {data.icon}
        <View className="flex-1" style={{ gap: 3 }}>
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-[14.5px] font-bold leading-5 text-gray-900">{data.title}</Text>
            <ManageButtons data={data} />
          </View>
          <Text className="text-[13px] text-gray-600" numberOfLines={1}>
            {data.who}
          </Text>
          {!!data.token && <Text className="text-xs font-bold text-gray-700">{`Token ${data.token}`}</Text>}
          {data.chalan && (
            <Pressable onPress={data.chalan.onEdit} hitSlop={4} className="flex-row items-center self-start" style={{ gap: 4 }}>
              <Text className="text-xs font-semibold" style={{ color: data.chalan.no ? '#374151' : '#0F766E' }}>
                {data.chalan.no ? `Chalan no. ${data.chalan.no}` : 'Add chalan no.'}
              </Text>
              <Ionicons name="create-outline" size={12} color="#6B7280" />
            </Pressable>
          )}
          {data.lines?.map((line) => (
            <Text key={line} className="text-xs text-gray-600">
              {line}
            </Text>
          ))}
          {!!meta && (
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {meta}
            </Text>
          )}
          <View className="mt-1 flex-row items-center gap-2">
            <TagPill tag={data.tag} />
            <Text className="ml-auto text-[15px] font-extrabold text-gray-900">{formatAmount(data.amount)}</Text>
          </View>
        </View>
      </Pressable>
      <ActionButton action={data.action} color={color} height={44} />
    </View>
  );
}

/** What a finished job shows: token and chalan numbers, the products used and the installation. */
function finishedLines(item: ServiceRequest, card: JobCard | undefined): string[] {
  const ids: (string | null | undefined)[] = [];
  const parts = (card?.parts_used ?? []).filter((p) => p.name?.trim());
  const products = parts.length > 0 ? `Products: ${parts.map((p) => `${p.name} × ${p.quantity}`).join(', ')}` : 'Products: none recorded';
  const installation = Number(card?.labor_cost) > 0 ? `Installation: NPR ${Number(card!.labor_cost).toLocaleString()}` : null;
  return [ids.filter(Boolean).join(' · '), [products, installation].filter(Boolean).join(' · ')].filter(Boolean);
}

function RequestJobRow({
  item,
  stage,
  wide,
  onEditChalan,
  selected,
  onToggleSelect,
}: {
  item: ServiceRequest;
  stage: Stage;
  wide: boolean;
  /** Finished jobs: open the box to type the chalan number by hand. */
  onEditChalan?: (item: ServiceRequest) => void;
  /** Completed jobs: whether this one is ticked for a combined bill. */
  selected?: boolean;
  onToggleSelect?: (item: ServiceRequest) => void;
}) {
  // A "reseller" origin request's client_id is just the reseller's own id
  // (there's no real customer profile behind it), so only look up real app
  // customers.
  const isIncoming = !item.reseller_id;
  // An unclaimed request only loads what the row shows - the customer's
  // number stays out of the app until this reseller accepts it.
  const { data: customerProfile } = useSupabaseRow(
    'profiles',
    item.origin === 'app' ? item.client_id : undefined,
    isIncoming ? 'id, full_name, avatar_url' : '*'
  );
  const { data: technicianProfile } = useSupabaseRow('profiles', item.technician_id ?? undefined);
  // A finished job lists what was used on it, from the technician's job card.
  const finishedStage = stage === 'completed' || stage === 'awaiting_payment' || stage === 'paid';
  const { data: jobCards } = useSupabaseQuery('job_cards', {
    filters: { service_request_id: item.id },
    enabled: finishedStage || wide,
  });
  const { confirmCancelWork, busyId } = useCancelWork();
  const deleting = busyId === item.id;

  const customerName = item.customer_name ?? customerProfile?.full_name ?? 'Customer';
  // An unclaimed request keeps the customer's number hidden until accepted.
  const customerPhone = isIncoming ? null : (item.customer_phone ?? customerProfile?.phone ?? null);
  const open = () => router.push(`/(reseller)/request/${item.id}`);

  const distance =
    item.location_data?.latitude != null &&
    item.location_data?.longitude != null &&
    technicianProfile?.latitude != null &&
    technicianProfile?.longitude != null
      ? distanceKm(
          { latitude: item.location_data.latitude, longitude: item.location_data.longitude },
          { latitude: technicianProfile.latitude, longitude: technicianProfile.longitude }
        )
      : null;

  let action: JobAction;
  if (isIncoming) {
    action = { label: 'View & accept', icon: 'checkmark-circle', primary: true, onPress: open };
  } else if (item.status === 'pending' && item.origin === 'app') {
    action = { label: 'Send quote', icon: 'pricetag-outline', primary: true, onPress: open };
  } else if (item.status === 'quoted') {
    action = customerPhone
      ? { label: 'Call customer', icon: 'call-outline', primary: false, onPress: () => Linking.openURL(`tel:${customerPhone}`) }
      : { label: 'View request', icon: 'eye-outline', primary: false, onPress: open };
  } else if (stage === 'my_jobs') {
    action = { label: 'Assign technician', icon: 'person-add-outline', primary: true, onPress: open };
  } else if (stage === 'in_progress' && item.hold_status === 'requested') {
    action = { label: 'Review hold request', icon: 'pause-circle-outline', primary: true, onPress: open };
  } else if (stage === 'in_progress') {
    action = { label: 'View job', icon: 'eye-outline', primary: false, onPress: open };
  } else if (stage === 'completed') {
    // The finished job becomes a bill: its products and installation pre-filled.
    action = {
      label: 'Create bill',
      icon: 'document-text-outline',
      primary: true,
      onPress: () => router.push(`/(reseller)/transactions?type=sale&add=1&fromJob=${item.id}` as any),
    };
  } else if (stage === 'awaiting_payment') {
    action = { label: 'Record payment', icon: 'cash-outline', primary: true, onPress: open };
  } else {
    action = { label: 'View', icon: 'eye-outline', primary: false, onPress: open };
  }

  const tag =
    stage === 'in_progress' && item.hold_status === 'requested'
      ? TAGS.holdRequested
      : stage === 'in_progress' && item.hold_status === 'on_hold'
        ? TAGS.onHold
        : stage === 'awaiting_payment' || stage === 'completed'
          ? TAGS.unpaid
          : stage === 'paid'
            ? TAGS.paid
            : item.origin === 'app'
              ? TAGS.app
              : TAGS.own;

  const place =
    stage === 'in_progress' && technicianProfile
      ? `${technicianProfile.full_name ?? 'Technician'}${distance != null ? ` · ${distance.toFixed(1)} km away` : ''}`
      : (item.location_data?.address ?? null);
  // Where the job has got to: Assigned, WIP, Hold, Completed.
  const progress = jobStages(item, jobCards?.[0]);

  // Any job this reseller owns can be cancelled while it's still open (a
  // no-show app customer included); only their own walk-in jobs can be
  // edited - an app customer's details and approved price are theirs.
  const canCancel = !isIncoming && canCancelWork(item);
  const canEdit = canCancel && item.origin === 'reseller';

  return (
    <JobRowView
      stage={stage}
      wide={wide}
      data={{
        icon: <CategoryBadge category={item.issue_type} size={wide ? 40 : 44} />,
        title: item.issue_type,
        who: customerName,
        customerPhone,
        technician: technicianProfile?.full_name ?? null,
        token: ticketLabel(item.ticket_no),
        progress,
        place: wide ? (item.location_data?.address ?? null) : place,
        when: formatScheduledWhen(item.scheduled_date, item.scheduled_time),
        lines: finishedStage ? finishedLines(item, jobCards?.[0]) : undefined,
        chalan: finishedStage && onEditChalan ? { no: item.chalan_no ?? null, onEdit: () => onEditChalan(item) } : undefined,
        select:
          wide && stage === 'completed' && onToggleSelect
            ? { checked: !!selected, onToggle: () => onToggleSelect(item) }
            : undefined,
        tag,
        amount: item.quoted_price,
        action,
        open,
        onEdit: canEdit ? () => router.push(`/(reseller)/edit-request?id=${item.id}`) : undefined,
        onDelete: canCancel ? () => confirmCancelWork(item) : undefined,
        deleting,
      }}
    />
  );
}

function OrderJobRow({
  order,
  stage,
  wide,
  productMap,
}: {
  order: Order;
  stage: Stage;
  wide: boolean;
  productMap: Map<string, Product>;
}) {
  const { data: buyer } = useSupabaseRow('profiles', order.buyer_id);
  const { data: orderItems } = useSupabaseQuery('order_items', { filters: { order_id: order.id } });
  const open = () => router.push(`/(reseller)/order/${order.id}`);

  const first = orderItems?.[0];
  const orderToken = ticketLabel(order.ticket_no);
  const firstName = first
    ? `${productMap.get(first.product_id)?.name ?? 'Product'} × ${first.quantity}`
    : orderToken
      ? `Token ${orderToken}`
      : `Order #${order.id.slice(0, 8)}`;
  const title = orderItems && orderItems.length > 1 ? `${firstName} + ${orderItems.length - 1} more` : firstName;

  const shipping = order.shipping_address as { address?: string; city?: string } | null;
  const place = shipping ? [shipping.address, shipping.city].filter(Boolean).join(', ') || null : null;

  // Confirming / delivering still happens on the order page itself - the
  // button just names what's waiting there.
  const nextLabel = STATUS_ACTION_LABEL[order.status];
  const action: JobAction = nextLabel
    ? { label: nextLabel, icon: 'checkmark-circle', primary: true, onPress: open }
    : { label: 'View order', icon: 'eye-outline', primary: false, onPress: open };

  return (
    <JobRowView
      stage={stage}
      wide={wide}
      data={{
        icon: (
          <View
            className="items-center justify-center bg-emerald-500"
            style={{ width: wide ? 40 : 44, height: wide ? 40 : 44, borderRadius: 12 }}
          >
            <Ionicons name="gift" size={wide ? 18 : 20} color="white" />
          </View>
        ),
        title,
        who: buyer?.full_name ?? '…',
        place,
        when: null,
        token: orderToken,
        tag: TAGS.order,
        amount: order.total_amount,
        action,
        open,
      }}
    />
  );
}

/** A sale bill added straight to a customer (not through a job). It starts under Completed with
 * no bill number; once the number is added it moves to Awaiting payment, and to Paid when the
 * customer's ledger is settled. */
function SaleBillRow({ sale, stage, wide }: { sale: BusinessTransaction; stage: Stage; wide: boolean }) {
  const hasBillNo = !!sale.bill_no?.trim();
  const editPath = `/(reseller)/transactions?type=sale&add=1&edit=${sale.id}`;
  const open = () => router.push(editPath as any);
  const action: JobAction = !hasBillNo
    ? { label: 'Add bill number', icon: 'document-text-outline', primary: true, onPress: open }
    : stage === 'paid'
      ? { label: 'View bill', icon: 'eye-outline', primary: false, onPress: open }
      : { label: 'Record payment', icon: 'cash-outline', primary: true, onPress: () => router.push('/(reseller)/quick-payment?type=in' as any) };
  const tag: Tag = !hasBillNo
    ? { label: 'Needs bill no.', bg: '#F3F4F6', fg: '#4B5563' }
    : stage === 'paid'
      ? TAGS.paid
      : TAGS.unpaid;
  return (
    <JobRowView
      stage={stage}
      wide={wide}
      data={{
        icon: (
          <View
            className="items-center justify-center bg-emerald-500"
            style={{ width: wide ? 40 : 44, height: wide ? 40 : 44, borderRadius: 12 }}
          >
            <Ionicons name="receipt" size={wide ? 18 : 20} color="white" />
          </View>
        ),
        title: hasBillNo ? `Sale · Bill #${sale.bill_no}` : 'Sale · no bill number yet',
        who: sale.party_name ?? 'Customer',
        place: null,
        when: sale.bill_date ?? sale.created_at.slice(0, 10),
        tag,
        amount: sale.amount,
        action,
        open,
      }}
    />
  );
}

export default function ResellerRequestQueue() {
  const userId = useAuthStore((state) => state.session?.user.id);
  // Once the reseller taps a pill, it stays picked - including across a
  // trip into a job's detail page and back, or switching tabs and
  // returning. jobStage only ever falls back to the smart "most needs
  // attention" default (below) while it's still null, i.e. before the
  // reseller has chosen anything themselves this session.
  const jobStage = useRequestsStageStore((state) => state.stage) as Stage | null;
  const setJobStage = useRequestsStageStore((state) => state.setStage);

  // A phone browser hitting the website is still "web" (Platform.OS ===
  // 'web'), but the pipeline + table layout only makes sense once the
  // viewport is wide enough - same breakpoint as the sidebar shell.
  const { width: screenWidth } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && screenWidth >= WEB_SIDEBAR_MIN_WIDTH;
  // The table is measured, not guessed from the window: what is left beside the side panel decides
  // which columns it can hold (see tierFor) - and when it holds too few, the jobs are cards.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const tableWidth = measuredWidth ?? screenWidth - 304;
  const tableMode = isWideWeb && tableWidth >= MIN_TABLE_WIDTH;
  const tier = tierFor(tableWidth);

  const { data: incomingRaw, isLoading: loadingIncoming } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    orderBy: { column: 'created_at', ascending: true },
  });
  // Any reseller can see a pending app request until someone claims it -
  // once reseller_id is stamped, it drops out of everyone else's pool.
  const incoming = useMemo(() => (incomingRaw ?? []).filter((r) => !r.reseller_id), [incomingRaw]);

  const { data: mine, isLoading: loadingMine } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  // Product orders from customers follow the same stage pipeline as a
  // service job (Shop has no separate Orders tab).
  const { data: sellingOrders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: true },
    enabled: !!userId,
  });
  // Sale bills added straight to a customer, and every customer's ledger entries to tell which
  // of them are settled: these follow Completed -> Awaiting payment -> Paid too.
  const { data: directSales } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId, type: 'sale' } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: ledgerEntries } = useSupabaseQuery('customer_ledger_entries', {
    filters: userId ? { owner_id: userId } : {},
    all: true,
    enabled: !!userId,
  });
  const { data: allProducts } = useSupabaseQuery('products', {});
  const productMap = useMemo(() => new Map((allProducts ?? []).map((p) => [p.id, p])), [allProducts]);

  // This is the front door of the whole customer -> reseller handoff: a new
  // app request (or one the customer just approved a quote on) needs to
  // show up here without the reseller having to background/foreground the
  // app or bounce off the tab first. Three separate subscriptions, one per
  // slice this screen actually reads, rather than one unfiltered listener
  // on the whole (large, multi-tenant) table.
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsubIncoming = subscribeToTable(
      'service_requests',
      () => queryClient.invalidateQueries({ queryKey: ['service_requests'] }),
      'status=eq.pending'
    );
    const unsubMine = userId
      ? subscribeToTable(
          'service_requests',
          () => queryClient.invalidateQueries({ queryKey: ['service_requests'] }),
          `reseller_id=eq.${userId}`
        )
      : undefined;
    const unsubOrders = userId
      ? subscribeToTable(
          'orders',
          () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
          `seller_id=eq.${userId}`
        )
      : undefined;
    return () => {
      unsubIncoming();
      unsubMine?.();
      unsubOrders?.();
    };
  }, [userId]);

  const isLoading = loadingIncoming || loadingMine;

  // Every job in one pipeline, whoever raised it: unclaimed requests from
  // customers, this reseller's own jobs, and the product orders that
  // follow the same stages.
  const myByStage = useMemo(() => {
    const groups = new Map<Stage, JobItem[]>();
    STAGE_ORDER.forEach((stage) => groups.set(stage, []));
    incoming.forEach((item) => groups.get('requests')!.push({ kind: 'request', id: item.id, request: item }));
    const billedJobs = new Set(
      (directSales ?? [])
        .filter((t) => t.source_type === 'service_request_bill')
        .flatMap((t) => [...(t.source_id ? [t.source_id] : []), ...(t.source_job_ids ?? [])])
    );
    (mine ?? []).forEach((item) => groups.get(stageOf(item, billedJobs))!.push({ kind: 'request', id: item.id, request: item }));
    (sellingOrders ?? []).forEach((order) =>
      groups.get(orderStageOf(order))!.push({ kind: 'order', id: order.id, order })
    );
    // A customer owes while their debits outrun their credits.
    const owed = new Map<string, number>();
    (ledgerEntries ?? []).forEach((e) =>
      owed.set(e.customer_id, (owed.get(e.customer_id) ?? 0) + (e.entry_type === 'debit' ? e.amount : -e.amount))
    );
    (directSales ?? []).forEach((sale) => {
      // Only bills typed in by hand to a saved customer; ones a job or order wrote are already
      // in the pipeline as that job or order.
      if (sale.source_type || !sale.customer_id) return;
      const stage: Stage = !sale.bill_no?.trim()
        ? 'completed'
        : (owed.get(sale.customer_id) ?? 0) > 0
          ? 'awaiting_payment'
          : 'paid';
      groups.get(stage)!.push({ kind: 'sale', id: sale.id, sale, stage });
    });
    return groups;
  }, [incoming, mine, sellingOrders, directSales, ledgerEntries]);

  const countOf = (stage: Stage) => myByStage.get(stage)?.length ?? 0;
  const activeStage = jobStage ?? STAGE_ORDER.find((stage) => countOf(stage) > 0) ?? 'requests';
  const stageJobs = myByStage.get(activeStage) ?? [];
  const activeMeta = STAGE_META[activeStage];

  // Keep the phone's pill strip and the list below it in sync: whichever
  // stage becomes active, scroll its pill into view at the same time.
  const chipScrollRef = useRef<ScrollView>(null);
  const chipLayouts = useRef<Partial<Record<Stage, { x: number; width: number }>>>({});

  useEffect(() => {
    const layout = chipLayouts.current[activeStage];
    if (layout) {
      chipScrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 24), animated: true });
    }
  }, [activeStage]);

  // Completed jobs ticked to go on one bill together (same customer / company, one bill number).
  const [pickedJobs, setPickedJobs] = useState<Set<string>>(new Set());
  const togglePicked = (job: ServiceRequest) =>
    setPickedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(job.id)) next.delete(job.id);
      else next.add(job.id);
      return next;
    });
  useEffect(() => setPickedJobs(new Set()), [activeStage]);

  // The chalan number can be typed in by hand on a finished job - until the field staff do it live.
  const [chalanTarget, setChalanTarget] = useState<ServiceRequest | null>(null);
  const [chalanInput, setChalanInput] = useState('');
  const [chalanSaving, setChalanSaving] = useState(false);
  const openChalan = (job: ServiceRequest) => {
    setChalanTarget(job);
    setChalanInput(job.chalan_no ?? '');
  };
  async function saveChalan() {
    if (!chalanTarget || chalanSaving) return;
    setChalanSaving(true);
    try {
      const { error } = await (supabase.from('service_requests') as any)
        .update({ chalan_no: chalanInput.trim() || null })
        .eq('id', chalanTarget.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      setChalanTarget(null);
    } catch (err) {
      showAlert('Could not save the chalan number', getErrorMessage(err));
    } finally {
      setChalanSaving(false);
    }
  }

  function billPickedJobs() {
    const jobs = stageJobs.flatMap((j) => (j.kind === 'request' && pickedJobs.has(j.id) ? [j.request] : []));
    if (jobs.length === 0) return;
    const customers = new Set(jobs.map((j) => j.customer_id ?? `name:${(j.customer_name ?? '').trim().toLowerCase()}`));
    if (customers.size > 1) {
      showAlert('One customer per bill', 'The ticked jobs belong to different customers. Tick jobs of the same customer or company.');
      return;
    }
    router.push(`/(reseller)/transactions?type=sale&add=1&fromJobs=${jobs.map((j) => j.id).join(',')}` as any);
  }

  const jobRow = (item: JobItem) =>
    item.kind === 'request' ? (
      <RequestJobRow
        key={`r-${item.id}`}
        item={item.request}
        stage={activeStage}
        wide={tableMode}
        onEditChalan={openChalan}
        selected={pickedJobs.has(item.id)}
        onToggleSelect={togglePicked}
      />
    ) : item.kind === 'sale' ? (
      <SaleBillRow key={`s-${item.id}`} sale={item.sale} stage={item.stage} wide={tableMode} />
    ) : (
      <OrderJobRow key={`o-${item.id}`} order={item.order} stage={activeStage} wide={tableMode} productMap={productMap} />
    );

  const emptyText = isLoading ? 'Loading…' : 'Nothing here right now.';

  // "My Jobs" and "Job in progress" are the Work Hub: its job cards, board and
  // tools replace the plain rows. Product orders follow the same stages, so
  // they sit under the cards in the ordinary rows.
  const hubStage = activeStage === 'my_jobs' || activeStage === 'in_progress' ? activeStage : null;
  const hubView = hubStage ? (
    <>
      <WorkHubPanel
        wide={isWideWeb}
        stage={hubStage}
        jobs={stageJobs.flatMap((item) => (item.kind === 'request' ? [item.request] : []))}
      />
      {stageJobs.some((item) => item.kind === 'order') && (
        <View style={{ gap: 8 }}>
          <Text className="text-[11px] font-bold capitalize tracking-wide text-gray-500">
            Shop orders to deliver and on the way
          </Text>
          {isWideWeb ? (
            <View style={{ gap: 8 }}>
              {stageJobs.filter((item) => item.kind === 'order').map(jobRow)}
            </View>
          ) : (
            stageJobs.filter((item) => item.kind === 'order').map(jobRow)
          )}
        </View>
      )}
    </>
  ) : null;

  const chalanModal = (
    <Modal visible={!!chalanTarget} transparent animationType="fade" onRequestClose={() => setChalanTarget(null)}>
          <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={() => setChalanTarget(null)}>
            <Pressable onPress={() => {}} className="w-full max-w-sm rounded-xl bg-white p-4">
              <Text className="text-base font-bold text-gray-900">Chalan number</Text>
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {chalanTarget ? `${ticketLabel(chalanTarget.ticket_no) ?? ''} ${chalanTarget.issue_type}` : ''}
              </Text>
              <TextInput
                value={chalanInput}
                onChangeText={setChalanInput}
                onSubmitEditing={saveChalan}
                autoFocus
                placeholder="Number written on the chalan"
                placeholderTextColor="#9CA3AF"
                className="mt-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
              />
              <View className="mt-4 flex-row justify-end" style={{ gap: 10 }}>
                <Pressable onPress={() => setChalanTarget(null)} className="h-10 items-center justify-center rounded-lg border border-gray-300 px-4">
                  <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveChalan}
                  disabled={chalanSaving}
                  className="h-10 items-center justify-center rounded-lg px-5 disabled:opacity-50"
                  style={{ backgroundColor: '#0F766E' }}
                >
                  <Text className="text-sm font-semibold text-white">{chalanSaving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
    </Modal>
  );

  if (isWideWeb) {
    const sidePill = (stage: Stage) => {
      const meta = STAGE_META[stage];
      const active = activeStage === stage;
      return (
        <Pressable
          key={stage}
          onPress={() => setJobStage(stage)}
          className="flex-row items-center gap-1.5 rounded-full bg-white px-3"
          style={{ height: 34, borderWidth: active ? 2 : 1, borderColor: active ? meta.color : '#E5E7EB' }}
        >
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <Text className="text-[12.5px] font-semibold" style={{ color: stage === 'cancelled' ? '#6B7280' : meta.color }}>
            {meta.label} ({countOf(stage)})
          </Text>
        </Pressable>
      );
    };

    return (
      <TierContext.Provider value={tier}>
      <ScrollView className="flex-1" style={{ backgroundColor: PAGE_BG }} contentContainerStyle={{ padding: 32, paddingTop: 20, gap: 16 }}>
        <View className="flex-row items-stretch" style={{ gap: 6 }}>
          {WORKING_STAGES.map((stage, index) => {
            const meta = STAGE_META[stage];
            const active = activeStage === stage;
            return (
              <View key={stage} className="flex-1 flex-row items-stretch" style={{ gap: 6 }}>
                <Pressable
                  onPress={() => setJobStage(stage)}
                  className="flex-1 flex-row items-center gap-2 rounded-xl bg-white px-3 py-3"
                  style={{ borderWidth: active ? 2 : 1, borderColor: active ? meta.color : '#E5E7EB' }}
                >
                  <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: meta.color }}>
                    <Text className="text-[13px] font-extrabold text-white">{countOf(stage)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold leading-4 text-gray-900" numberOfLines={2}>
                      {meta.label}
                    </Text>
                    <Text className="mt-0.5 text-[11.5px] leading-4 text-gray-500" numberOfLines={2}>
                      {meta.todo}
                    </Text>
                  </View>
                </Pressable>
                {index < WORKING_STAGES.length - 1 && (
                  <View className="justify-center">
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row" style={{ gap: 8 }}>
            {SIDE_STAGES.map(sidePill)}
          </View>
          <Pressable
            onPress={() => router.push('/(reseller)/new-request?from=requests')}
            className="flex-row items-center gap-1.5 rounded-lg bg-orange-500 px-4"
            style={{ height: 38 }}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text className="text-sm font-semibold text-white">New request</Text>
          </Pressable>
        </View>

        {hubView ?? (
        <View style={{ gap: 8 }} onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}>
          <View className="flex-row items-center gap-2.5 rounded-lg px-4 py-3" style={{ backgroundColor: activeMeta.tint }}>
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeMeta.color }} />
            <Text className="text-[15px] font-bold text-gray-900">{activeMeta.label}</Text>
            <Text className="text-[13px] text-gray-500">— {activeMeta.todo}</Text>
          </View>
          {activeStage === 'completed' && pickedJobs.size > 0 && (
            <View className="flex-row flex-wrap items-center rounded-lg px-4 py-2.5" style={{ gap: 10, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }}>
              <Text className="flex-1 text-[13px] font-semibold text-gray-800">
                {pickedJobs.size} {pickedJobs.size === 1 ? 'job' : 'jobs'} ticked - bill them together under one bill number
              </Text>
              <Pressable onPress={() => setPickedJobs(new Set())} hitSlop={6}>
                <Text className="text-[12.5px] font-semibold text-gray-600">Clear</Text>
              </Pressable>
              <Pressable onPress={billPickedJobs} className="h-9 flex-row items-center gap-1.5 rounded-lg px-3.5" style={{ backgroundColor: '#0F766E' }}>
                <Ionicons name="document-text-outline" size={15} color="#FFFFFF" />
                <Text className="text-[13px] font-semibold text-white">Create one bill</Text>
              </Pressable>
            </View>
          )}
          {tableMode && (
            <View className="flex-row rounded-lg px-4 py-2" style={{ gap: TIER_GAP[tier], backgroundColor: '#F3F4F6' }}>
              {activeStage === 'completed' && <View style={{ width: 20 }} />}
              {TIER_COLUMNS[tier].map((key) => {
                const fixed = TIER_WIDTH[tier][key];
                const style =
                  fixed != null
                    ? { width: fixed, textAlign: key === 'amount' || key === 'actions' ? ('right' as const) : undefined }
                    : { flexBasis: 0, flexGrow: TIER_GROW[tier][key as 'job' | 'customer' | 'where'], minWidth: 0 };
                return (
                  <Text
                    key={key}
                    className="text-[11px] font-bold capitalize tracking-wide text-gray-500"
                    style={style}
                    numberOfLines={1}
                  >
                    {HEAD_LABEL[key]}
                  </Text>
                );
              })}
            </View>
          )}
          {stageJobs.length === 0 ? (
            <Text className="px-4 py-6 text-sm text-gray-500">{emptyText}</Text>
          ) : (
            stageJobs.map(jobRow)
          )}
        </View>
        )}
        {chalanModal}
      </ScrollView>
      </TierContext.Provider>
    );
  }

  return (
    <View className="flex-1 pt-3.5" style={{ backgroundColor: PAGE_BG }}>
      <ScrollView
        ref={chipScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16 }}
      >
        {STAGE_ORDER.map((stage) => {
          const meta = STAGE_META[stage];
          const active = activeStage === stage;
          return (
            <Pressable
              key={stage}
              onPress={() => setJobStage(stage)}
              onLayout={(e) => {
                chipLayouts.current[stage] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              }}
              className="flex-row items-center gap-2 rounded-full py-2 pl-2 pr-3"
              style={{
                backgroundColor: active ? meta.color : '#FFFFFF',
                borderWidth: active ? 0 : 1,
                borderColor: '#E5E7EB',
              }}
            >
              <View
                className="h-6 items-center justify-center rounded-full px-1.5"
                style={{ minWidth: 24, backgroundColor: active ? 'rgba(255,255,255,0.25)' : meta.color }}
              >
                <Text className="text-xs font-extrabold text-white">{countOf(stage)}</Text>
              </View>
              <Text className={`text-[13px] font-bold ${active ? 'text-white' : 'text-gray-700'}`}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mx-4 mb-3 mt-2.5 flex-row items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: activeMeta.tint }}>
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: activeMeta.color }} />
        <Text className="text-[13px] text-gray-700">
          <Text className="font-bold text-gray-900">Next step: </Text>
          {activeMeta.todo.toLowerCase()}
        </Text>
      </View>

      {hubView ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90, gap: 14 }}>
          {hubView}
        </ScrollView>
      ) : (
        <FlatList
          data={stageJobs}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={({ item }) => jobRow(item)}
          ListEmptyComponent={<Text className="text-gray-500">{emptyText}</Text>}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
        />
      )}

      <Pressable
        onPress={() => router.push('/(reseller)/new-request?from=requests')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-orange-500 shadow-lg"
        style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
      {chalanModal}
    </View>
  );
}
