// app/(client)/notifications.tsx
import { NotificationsScreen } from '../../lib/components/NotificationsScreen';

/** What has happened on the customer's requests: a quote to look at, a
 * technician assigned, work started, the job done, a payment, a cancellation. */
export default function ClientNotifications() {
  return (
    <NotificationsScreen
      portal="client"
      emptyHint="You will see it here, and as a pop-up, when you get a quote, a technician is assigned, work starts or your job is done."
    />
  );
}
