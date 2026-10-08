// app/(reseller)/transactions.tsx
import { TransactionsScreen } from '../../lib/components/finance/TransactionsScreen';

export default function TransactionsRoute() {
  return <TransactionsScreen basePath="/(reseller)" />;
}
