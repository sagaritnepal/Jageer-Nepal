// app/(wholesaler)/to-receive.tsx
import { PartyBalancesScreen } from '../../lib/components/finance/PartyBalancesScreen';

export default function WholesalerToReceive() {
  return <PartyBalancesScreen basePath="/(wholesaler)" direction="receive" />;
}
