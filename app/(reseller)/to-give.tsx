// app/(reseller)/to-give.tsx
import { PartyBalancesScreen } from '../../lib/components/finance/PartyBalancesScreen';

export default function ResellerToGive() {
  return <PartyBalancesScreen basePath="/(reseller)" direction="give" />;
}
