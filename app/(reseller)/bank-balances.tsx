// app/(reseller)/bank-balances.tsx
import { BankBalancesScreen } from '../../lib/components/finance/BankBalancesScreen';

export default function ResellerBankBalances() {
  return <BankBalancesScreen basePath="/(reseller)" />;
}
