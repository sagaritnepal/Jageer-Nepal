// app/(technician)/notifications.tsx
import { NotificationsScreen } from '../../lib/components/NotificationsScreen';

/** Everything addressed to the technician: job offers, a reseller taking a job
 * back or cancelling work, answers to hold and leave requests, team invitations. */
export default function TechnicianNotifications() {
  return (
    <NotificationsScreen
      portal="technician"
      emptyHint="You will see it here when you are offered a job, a reseller answers a request of yours or work is cancelled."
    />
  );
}
