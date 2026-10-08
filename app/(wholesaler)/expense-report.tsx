// app/(wholesaler)/expense-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function WholesalerExpenseReport() {
  return <TotalsReportScreen kind="expense" basePath="/(wholesaler)" />;
}
