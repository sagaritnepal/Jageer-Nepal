// app/(reseller)/requests/board.tsx
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useIsWideWeb } from '../../../lib/hooks/useWideGrid';
import { WorkHubPanel } from '../../../lib/components/requests/WorkHubPanel';

/** "View details" on Requests: who is carrying what. A screen of its own, not a
 * switch inside Requests, so Back returns to the Requests list. "Assign" on a job
 * opens it with `find` set to that job's ticket, so the job is the one on screen. */
export default function RequestsBoard() {
  const wide = useIsWideWeb();
  const { find } = useLocalSearchParams<{ find?: string }>();
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 48 }}>
      <WorkHubPanel wide={wide} stage="my_jobs" jobs={[]} boardOnly initialQuery={find} />
    </ScrollView>
  );
}
