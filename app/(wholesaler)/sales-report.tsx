// app/(wholesaler)/sales-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function WholesalerSalesReport() {
  return <TotalsReportScreen kind="sale" basePath="/(wholesaler)" />;
}
