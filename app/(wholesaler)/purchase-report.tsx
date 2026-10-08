// app/(wholesaler)/purchase-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function WholesalerPurchaseReport() {
  return <TotalsReportScreen kind="purchase" basePath="/(wholesaler)" />;
}
