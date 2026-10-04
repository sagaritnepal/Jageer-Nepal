// lib/components/JobAcceptedNotice.tsx
import { useEffect, useRef, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToTable, useSupabaseRow } from '../hooks/useSupabase';
import { useResellerNotifications, type AcceptedJob } from '../hooks/useResellerNotifications';
import { HoldCapsule } from './HoldNotice';

const SHOW_FOR_MS = 12_000;

function AcceptedCapsule({
  jobs,
  onOpen,
  onDismiss,
}: {
  jobs: AcceptedJob[];
  onOpen: (job: AcceptedJob) => void;
  onDismiss: () => void;
}) {
  const first = jobs[0];
  const { data: technician } = useSupabaseRow('profiles', first.technicianId);
  const name = technician?.full_name ?? 'A technician';
  const label =
    jobs.length === 1 ? `${name} accepted ${first.issueType}` : `${jobs.length} jobs accepted by your technicians`;

  return (
    <HoldCapsule
      tone="green"
      icon="checkmark-circle"
      label={label}
      onPress={() => onOpen(first)}
      onDismiss={onDismiss}
    />
  );
}

/** Reseller side: pops up at the top of whichever screen is open the moment a
 * technician accepts one of their jobs (or takes an open team job), with a tap
 * to open it. Only a job that arrives while the app is open pops up - the first
 * load just records what is already there, so old acceptances do not pop up
 * again on every launch (they wait in the notification bell instead). */
export function ResellerJobAcceptedNotice({ resellerId }: { resellerId: string | undefined }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { items, loaded, markSeen } = useResellerNotifications(resellerId);
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<AcceptedJob[]>([]);

  // The moment one of this reseller's jobs changes, refetch the job cards (a
  // job card is created in the same step as the acceptance). Opened here once,
  // not in the hook: the bell uses the same hook, and two subscriptions to the
  // same table and filter would clash.
  useEffect(() => {
    if (!resellerId) return;
    return subscribeToTable(
      'service_requests',
      () => {
        queryClient.invalidateQueries({ queryKey: ['job_cards'] });
        queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      },
      `reseller_id=eq.${resellerId}`,
      'job-accepted-notice'
    );
  }, [resellerId, queryClient]);

  useEffect(() => {
    if (!loaded) return;
    if (known.current) {
      const seen = known.current;
      const arrived = items.filter((item) => !seen.has(item.id));
      if (arrived.length > 0) setFresh(arrived);
    }
    known.current = new Set(items.map((item) => item.id));
  }, [items, loaded]);

  useEffect(() => {
    if (fresh.length === 0) return;
    const hide = setTimeout(() => setFresh([]), SHOW_FOR_MS);
    return () => clearTimeout(hide);
  }, [fresh]);

  if (fresh.length === 0 || pathname === `/request/${fresh[0].requestId}`) return null;

  return (
    <AcceptedCapsule
      key={fresh.map((job) => job.id).join(',')}
      jobs={fresh}
      onOpen={(job) => {
        setFresh([]);
        markSeen();
        router.push(`/(reseller)/request/${job.requestId}` as any);
      }}
      onDismiss={() => setFresh([])}
    />
  );
}
