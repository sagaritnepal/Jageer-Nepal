// lib/components/technician/WorkingNowCard.tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSupabaseQuery, useSupabaseRow } from '../../hooks/useSupabase';
import { useIsWideWeb } from '../../hooks/useWideGrid';
import { CategoryBadge } from '../CategoryBadge';
import { formatDuration, formatTimestamp } from '../../utils/duration';
import type { ServiceRequest } from '../../../types/database.types';

const CARD = 'rounded-2xl border border-gray-200 bg-white';

// More than this and the card would turn into the whole jobs list - the rest
// are one tap away on My Jobs.
const MAX_SHOWN = 3;

// Ticks once a minute, like the Jobs tab: jobs run from minutes to days, so
// second-level precision would only cause needless re-renders.
function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

function CardHeader({ count }: { count: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-2 w-2 rounded-full ${count > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
      <Text className="flex-1 text-[11px] font-bold uppercase text-gray-500" style={{ letterSpacing: 0.6 }}>
        Working on now
      </Text>
      {count > 1 && <Text className="text-[11px] font-bold text-blue-700">{count} jobs</Text>}
    </View>
  );
}

/** One job in progress: what it is, who it is for, where, and how long it has
 * been going. The whole row opens the job card. */
function WorkingJobRow({ job, wide }: { job: ServiceRequest; wide: boolean }) {
  const needsCustomerLookup = !job.customer_name;
  const { data: customer } = useSupabaseRow('profiles', needsCustomerLookup ? job.client_id : undefined);
  const { data: jobCards } = useSupabaseQuery('job_cards', {
    filters: { service_request_id: job.id },
  });
  const startedAt = jobCards?.[0]?.started_at ?? null;
  const now = useNow(!!startedAt);

  const customerName = job.customer_name ?? customer?.full_name;
  const address = job.location_data?.address;
  const onHold = job.hold_status === 'on_hold';
  const holdRequested = job.hold_status === 'requested';

  return (
    <Pressable
      onPress={() => router.push(`/(technician)/job/${job.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open job: ${job.issue_type}`}
      className="flex-row items-center gap-3 active:opacity-70"
    >
      <CategoryBadge category={job.issue_type} />
      <View className="flex-1" style={{ gap: 2 }}>
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          <Text className="text-[14.5px] font-bold text-gray-900" numberOfLines={1}>
            {job.issue_type}
          </Text>
          {(onHold || holdRequested) && (
            <View className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
              <Ionicons name="pause-circle" size={11} color="#92400E" />
              <Text className="text-[10px] font-semibold text-amber-800">{onHold ? 'On hold' : 'Hold requested'}</Text>
            </View>
          )}
        </View>
        {!!customerName && (
          <Text className="text-xs text-gray-600" numberOfLines={1}>
            {customerName}
            {address ? ` · ${address}` : ''}
          </Text>
        )}
        {!customerName && !!address && (
          <Text className="text-xs text-gray-600" numberOfLines={1}>
            {address}
          </Text>
        )}
        {!!startedAt && (
          <Text className="text-xs text-gray-500" numberOfLines={wide ? 1 : 2}>
            <Text className="font-bold text-blue-700">Time elapsed: {formatDuration(now - new Date(startedAt).getTime())}</Text>
            {` · Accepted at: ${formatTimestamp(startedAt)}`}
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-1">
        {wide && <Text className="text-[12.5px] font-semibold text-blue-700">Open job</Text>}
        <Ionicons name="chevron-forward" size={16} color={wide ? '#1D4ED8' : '#9CA3AF'} />
      </View>
    </Pressable>
  );
}

/** The technician dashboard's "what am I on right now" card: every job they
 * have accepted and not yet finished. It follows the jobs live (the portal
 * already refreshes service requests whenever one changes), and shows a quiet
 * empty state when nothing is in progress. */
export function WorkingNowCard({ technicianId }: { technicianId: string }) {
  const wide = useIsWideWeb();
  const { data: jobs } = useSupabaseQuery('service_requests', {
    filters: { technician_id: technicianId, status: 'in_progress' },
    orderBy: { column: 'created_at', ascending: false },
  });

  // Until the first answer comes back there is nothing to say yet.
  if (jobs === undefined) {
    return (
      <View className={CARD} style={{ padding: wide ? 20 : 16, gap: 12 }}>
        <CardHeader count={0} />
        <View className="h-10 rounded-lg bg-gray-100" />
      </View>
    );
  }

  const shown = jobs.slice(0, MAX_SHOWN);
  const hidden = jobs.length - shown.length;

  return (
    <View className={CARD} style={{ padding: wide ? 20 : 16, gap: 14 }}>
      <CardHeader count={jobs.length} />

      {jobs.length === 0 ? (
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="construct-outline" size={20} color="#9CA3AF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-700">Not working on a job right now</Text>
            <Text className="text-xs text-gray-500">A job you accept shows up here while you work on it.</Text>
          </View>
        </View>
      ) : (
        shown.map((job, index) => (
          <View key={job.id} className={index > 0 ? 'border-t border-gray-100 pt-3.5' : ''}>
            <WorkingJobRow job={job} wide={wide} />
          </View>
        ))
      )}

      {hidden > 0 && (
        <Pressable
          onPress={() =>
            // `t` changes every time so My Jobs reacts even if it is already open on another tab.
            router.push({ pathname: '/(technician)/jobs', params: { tab: 'in_progress', t: String(Date.now()) } })
          }
          accessibilityRole="button"
          className="self-start"
        >
          <Text className="text-[12.5px] font-semibold text-blue-700">
            + {hidden} more in progress - see all in My Jobs
          </Text>
        </Pressable>
      )}
    </View>
  );
}
