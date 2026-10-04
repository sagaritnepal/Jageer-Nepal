// app/(reseller)/notifications.tsx
import { NotificationsScreen } from '../../lib/components/NotificationsScreen';

/** What has happened on the reseller's jobs and team lately: technicians
 * accepting, declining and finishing work, payments, customers answering a
 * quote, people joining or asking to leave the team. */
export default function ResellerNotifications() {
  return (
    <NotificationsScreen
      portal="reseller"
      emptyHint="You will see it here, and as a pop-up, when a technician accepts a job, finishes it, records a payment, a customer approves a quote and more."
    />
  );
}
