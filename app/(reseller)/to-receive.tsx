// app/(reseller)/to-receive.tsx
import { PartyBalancesScreen } from '../../lib/components/finance/PartyBalancesScreen';

export default function ResellerToReceive() {
  return <PartyBalancesScreen basePath="/(reseller)" direction="receive" />;
}
