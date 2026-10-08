// app/(reseller)/sales-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function ResellerSalesReport() {
  return <TotalsReportScreen kind="sale" basePath="/(reseller)" />;
}
