// app/(reseller)/expense-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function ResellerExpenseReport() {
  return <TotalsReportScreen kind="expense" basePath="/(reseller)" />;
}
