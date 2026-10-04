// lib/components/PushTapHandler.native.tsx
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../hooks/useAuth';
import { NOTIFICATIONS_PAGE, notificationHref, type NotificationPortal } from '../constants/notificationKinds';
import type { NotificationKind } from '../../types/database.types';

const PORTALS: string[] = ['client', 'reseller', 'technician'];

/** Tapping a push - while the app is closed, in the background or open - takes the
 * person to what it is about: the job, the team screen, or their notifications
 * list. Waits until they are signed in, so a tap that launches a closed app
 * still arrives after the login is restored. */
export function PushTapHandler() {
  const role = useAuthStore((state) => state.profile?.role);
  const userId = useAuthStore((state) => state.session?.user.id);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse || !userId || !role || !PORTALS.includes(role)) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = lastResponse.notification.request.identifier;
    if (handled.current === key) return;
    handled.current = key;

    const data = lastResponse.notification.request.content.data as { kind?: string; request_id?: string | null };
    const portal = role as NotificationPortal;
    const href =
      notificationHref({ kind: (data.kind ?? '') as NotificationKind, request_id: data.request_id ?? null }, portal) ??
      NOTIFICATIONS_PAGE[portal];
    router.push(href as never);
  }, [lastResponse, userId, role]);

  return null;
}
