// lib/hooks/useResellerNotifications.ts
import { useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useSupabaseQuery } from './useSupabase';
import type { JobCard } from '../../types/database.types';

// Anything older than this drops off the list - it is a feed of what just
// happened, not a history (the Requests and Team pages have that).
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const seenKey = (userId: string) => `reseller-notifications-seen:${userId}`;

interface SeenState {
  userId: string | null;
  seenAt: string | null;
  ready: boolean;
  init: (userId: string) => Promise<void>;
  markSeen: () => void;
}

/** When this reseller last opened their notifications. Kept on the device. */
const useSeenStore = create<SeenState>((set, get) => ({
  userId: null,
  seenAt: null,
  ready: false,
  init: async (userId) => {
    if (get().userId === userId) return;
    set({ userId, seenAt: null, ready: false });
    let stored: string | null = null;
    try {
      stored = await AsyncStorage.getItem(seenKey(userId));
    } catch {
      // Storage unavailable: behave as a first run below.
    }
    // First time on this device: nothing that already happened counts as new.
    const seenAt = stored ?? new Date().toISOString();
    if (!stored) AsyncStorage.setItem(seenKey(userId), seenAt).catch(() => {});
    if (get().userId === userId) set({ seenAt, ready: true });
  },
  markSeen: () => {
    const { userId } = get();
    if (!userId) return;
    const now = new Date().toISOString();
    set({ seenAt: now });
    AsyncStorage.setItem(seenKey(userId), now).catch(() => {});
  },
}));

/** A technician took one of this reseller's jobs. */
export interface AcceptedJob {
  /** The job card's id - one per job, created the moment it is accepted. */
  id: string;
  requestId: string;
  issueType: string;
  technicianId: string;
  /** When it was accepted. */
  at: string;
}

type JobCardWithRequest = JobCard & {
  service_requests: { issue_type: string; reseller_id: string | null } | null;
};

/** The reseller's notifications: jobs a technician has accepted lately, newest
 * first. A job card is created in the same step as the acceptance (whether the
 * technician accepted an offer or took an open team job), so this is exactly
 * "who accepted what, and when" - and it is still there if the reseller was
 * away when it happened. `unread` counts those since they last opened the
 * notifications page. */
export function useResellerNotifications(resellerId: string | undefined) {
  const init = useSeenStore((state) => state.init);
  const seenAt = useSeenStore((state) => state.seenAt);
  const ready = useSeenStore((state) => state.ready);
  const markSeen = useSeenStore((state) => state.markSeen);

  useEffect(() => {
    if (resellerId) init(resellerId);
  }, [resellerId, init]);

  // A reseller can read the job cards of their own jobs. The slow poll is the
  // safety net for when the live connection drops (the popup also refreshes
  // this the moment one of their jobs changes).
  const { data } = useSupabaseQuery('job_cards', {
    columns: '*, service_requests(issue_type, reseller_id)',
    orderBy: { column: 'started_at', ascending: false },
    enabled: !!resellerId,
    queryOptions: { refetchInterval: 15_000 },
  }) as { data: JobCardWithRequest[] | undefined };

  const items = useMemo<AcceptedJob[]>(
    () =>
      (data ?? [])
        .filter(
          (card) =>
            !!card.started_at &&
            card.service_requests?.reseller_id === resellerId &&
            Date.now() - new Date(card.started_at).getTime() <= WINDOW_MS
        )
        .map((card) => ({
          id: card.id,
          requestId: card.service_request_id,
          issueType: card.service_requests?.issue_type ?? 'a job',
          technicianId: card.technician_id,
          at: card.started_at as string,
        })),
    [data, resellerId]
  );

  const unread = useMemo(() => {
    if (!ready || !seenAt) return 0;
    const seen = new Date(seenAt).getTime();
    return items.filter((item) => new Date(item.at).getTime() > seen).length;
  }, [items, ready, seenAt]);

  return { items, unread, seenAt, loaded: data !== undefined && ready, markSeen };
}
