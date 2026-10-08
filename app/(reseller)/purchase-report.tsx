// app/(reseller)/purchase-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function ResellerPurchaseReport() {
  return <TotalsReportScreen kind="purchase" basePath="/(reseller)" />;
}
