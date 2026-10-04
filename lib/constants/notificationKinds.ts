// lib/constants/notificationKinds.ts
import type { Ionicons } from '@expo/vector-icons';
import type { AppNotification, NotificationKind } from '../../types/database.types';

export type NotificationTone = 'green' | 'amber' | 'gray' | 'red' | 'blue';

interface NotificationStyle {
  icon: keyof typeof Ionicons.glyphMap;
  tone: NotificationTone;
}

/** How each kind of notification looks - the pop-up pill and the list row
 * share this, so one event always has the same icon and colour. */
export const NOTIFICATION_STYLE: Record<NotificationKind, NotificationStyle> = {
  job_accepted: { icon: 'checkmark-circle', tone: 'green' },
  job_declined: { icon: 'close-circle', tone: 'red' },
  hold_requested: { icon: 'pause-circle', tone: 'amber' },
  hold_resumed: { icon: 'play-circle', tone: 'green' },
  job_completed: { icon: 'checkmark-done-circle', tone: 'green' },
  job_reopened: { icon: 'refresh-circle', tone: 'amber' },
  payment_recorded: { icon: 'cash', tone: 'green' },
  chalan_added: { icon: 'receipt', tone: 'gray' },
  work_cancelled: { icon: 'close-circle', tone: 'red' },
  quote_received: { icon: 'pricetag', tone: 'blue' },
  technician_assigned: { icon: 'person-add', tone: 'blue' },
  job_started: { icon: 'construct', tone: 'blue' },
  quote_approved: { icon: 'thumbs-up', tone: 'green' },
  job_offered: { icon: 'briefcase', tone: 'blue' },
  offer_withdrawn: { icon: 'arrow-undo', tone: 'gray' },
  hold_approved: { icon: 'pause-circle', tone: 'amber' },
  hold_declined: { icon: 'play-circle', tone: 'gray' },
  team_invite: { icon: 'people', tone: 'blue' },
  team_application: { icon: 'person-add', tone: 'blue' },
  team_accepted: { icon: 'checkmark-circle', tone: 'green' },
  team_declined: { icon: 'close-circle', tone: 'red' },
  team_removed: { icon: 'exit', tone: 'gray' },
  leave_requested: { icon: 'exit-outline', tone: 'amber' },
  leave_approved: { icon: 'checkmark-circle', tone: 'green' },
  leave_declined: { icon: 'close-circle', tone: 'red' },
};

const FALLBACK: NotificationStyle = { icon: 'notifications', tone: 'gray' };

/** A kind this build does not know about (added later on the server) still
 * shows, in neutral grey, rather than breaking the list. */
export function notificationStyle(kind: string): NotificationStyle {
  return NOTIFICATION_STYLE[kind as NotificationKind] ?? FALLBACK;
}

/** Soft tint behind a row's icon, and the icon's own colour. */
export const NOTIFICATION_TINT: Record<NotificationTone, { bg: string; fg: string }> = {
  green: { bg: '#DCFCE7', fg: '#16A34A' },
  amber: { bg: '#FEF3C7', fg: '#D97706' },
  gray: { bg: '#F3F4F6', fg: '#4B5563' },
  red: { bg: '#FEE2E2', fg: '#DC2626' },
  blue: { bg: '#DBEAFE', fg: '#2563EB' },
};

/** Kinds that do not pop up here because something else already does, with
 * the answer on it: the hold-request pill and the leave-request dialog (the
 * reseller), the ringing job offer and the hold / leave answers (the
 * technician). They still appear in the list. */
export const NO_POPUP_KINDS: NotificationKind[] = [
  'hold_requested',
  'job_offered',
  'hold_approved',
  'hold_declined',
  'leave_requested',
  'leave_approved',
  'leave_declined',
];

export type NotificationPortal = 'client' | 'reseller' | 'technician';

// About a team, not a job: these open the team screen.
const TEAM_KINDS: NotificationKind[] = [
  'team_invite',
  'team_application',
  'team_accepted',
  'team_declined',
  'team_removed',
  'leave_requested',
  'leave_approved',
  'leave_declined',
];

/** Where tapping a notification goes in this portal: the job it is about, the
 * team screen for a team one, or nowhere. */
export function notificationHref(
  item: Pick<AppNotification, 'kind' | 'request_id'>,
  portal: NotificationPortal
): string | null {
  if (item.request_id) {
    return portal === 'technician'
      ? `/(technician)/job/${item.request_id}`
      : portal === 'reseller'
        ? `/(reseller)/request/${item.request_id}`
        : `/(client)/request/${item.request_id}`;
  }
  if (TEAM_KINDS.includes(item.kind)) {
    if (portal === 'technician') return '/(technician)/employment';
    if (portal === 'reseller') return '/(reseller)/employees';
  }
  return null;
}

/** The page that lists a person's notifications. */
export const NOTIFICATIONS_PAGE: Record<NotificationPortal, string> = {
  client: '/(client)/notifications',
  reseller: '/(reseller)/notifications',
  technician: '/(technician)/notifications',
};
