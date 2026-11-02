// app/(reseller)/requests/board.tsx
import { ScrollView } from 'react-native';
import { useIsWideWeb } from '../../../lib/hooks/useWideGrid';
import { WorkHubPanel } from '../../../lib/components/requests/WorkHubPanel';

/** "View details" on Requests: who is carrying what. A screen of its own, not a
 * switch inside Requests, so Back returns to the Requests list. */
export default function RequestsBoard() {
  const wide = useIsWideWeb();
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 48 }}>
      <WorkHubPanel wide={wide} stage="my_jobs" jobs={[]} boardOnly />
    </ScrollView>
  );
}
