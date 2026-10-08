// app/(reseller)/transactions.tsx
import { Redirect, useLocalSearchParams } from 'expo-router';
import { TransactionsScreen } from '../../lib/components/finance/TransactionsScreen';

// This route is the Sale / Purchase / Expense entry form (?add=1 to record one, ?edit=<id> to
// change one). The list of entries that used to be here - the Statement - is the Day Book now,
// so an old link or bookmark to the list goes there, to the same kind of entries.
export default function TransactionsRoute() {
  const { add, edit, type } = useLocalSearchParams<{ add?: string; edit?: string; type?: string }>();
  if (add !== '1' && !edit) return <Redirect href={`/(reseller)/daybook?show=${type || 'all'}` as never} />;
  return <TransactionsScreen basePath="/(reseller)" />;
}
