// lib/components/NotificationPopup.tsx
import { useEffect, useRef, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToTable } from '../hooks/useSupabase';
import { useNotifications } from '../hooks/useNotifications';
import {
  NOTIFICATIONS_PAGE,
  NO_POPUP_KINDS,
  notificationHref,
  notificationStyle,
  type NotificationPortal,
} from '../constants/notificationKinds';
import { HoldCapsule } from './HoldNotice';
import type { AppNotification } from '../../types/database.types';

const SHOW_FOR_MS = 12_000;

// How a job's own page shows up in usePathname() (route groups are not part
// of it), so a pill is not shown for the job the person is already looking at.
const JOB_PATH = {
  reseller: (id: string) => `/request/${id}`,
  client: (id: string) => `/request/${id}`,
  technician: (id: string) => `/job/${id}`,
} as const;

const MANY_LABEL = {
  reseller: (count: number) => `${count} new updates on your jobs`,
  client: (count: number) => `${count} new updates on your requests`,
  technician: (count: number) => `${count} new updates`,
} as const;

/** Pops up at the top of whichever screen is open the moment a notification
 * arrives - for a customer a quote, an assigned technician or a finished job;
 * for a reseller what a technician or customer did; for a technician cancelled
 * work or a team invitation - with a tap to open it. Questions that already
 * have their own pop-up (see NO_POPUP_KINDS) are left to it. Only one that
 * arrives while the app is open pops up: the first
 * load just records what is already there, so old ones do not pop up again on
 * every launch (they wait, unread, in the bell instead).
 *
 * This is also the one place that listens for new rows live; the bell and the
 * list read the same query and update when this refetches it. */
export function NotificationPopup({ userId, portal }: { userId: string | undefined; portal: NotificationPortal }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { items, loaded, markRead } = useNotifications(userId);
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToTable(
      'notifications',
      () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      `user_id=eq.${userId}`,
      'popup'
    );
  }, [userId, queryClient]);

  // A different person signed in: start from what is already there again.
  useEffect(() => {
    known.current = null;
    setFresh((current) => (current.length > 0 ? [] : current));
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    const seen = known.current;
    known.current = new Set(items.map((item) => item.id));
    if (!seen) return;

    const arrived = items.filter((item) => !seen.has(item.id) && !item.read_at && !NO_POPUP_KINDS.includes(item.kind));
    if (arrived.length === 0) return;

    // Already looking at that job: no pill, and it counts as read.
    const here = arrived.filter((item) => !!item.request_id && pathRef.current === JOB_PATH[portal](item.request_id));
    if (here.length > 0) markRead(here.map((item) => item.id));
    const toShow = arrived.filter((item) => !here.includes(item));
    if (toShow.length > 0) setFresh(toShow);
  }, [items, loaded, markRead, portal]);

  useEffect(() => {
    if (fresh.length === 0) return;
    const hide = setTimeout(() => setFresh([]), SHOW_FOR_MS);
    return () => clearTimeout(hide);
  }, [fresh]);

  if (fresh.length === 0) return null;

  const first = fresh[0];
  const { icon, tone } = notificationStyle(first.kind);
  const several = fresh.length > 1;

  return (
    <HoldCapsule
      key={fresh.map((item) => item.id).join(',')}
      tone={tone}
      icon={icon}
      label={several ? MANY_LABEL[portal](fresh.length) : first.title}
      onPress={() => {
        setFresh([]);
        markRead(fresh.map((item) => item.id));
        router.push(((!several && notificationHref(first, portal)) || NOTIFICATIONS_PAGE[portal]) as any);
      }}
      onDismiss={() => setFresh([])}
    />
  );
}
