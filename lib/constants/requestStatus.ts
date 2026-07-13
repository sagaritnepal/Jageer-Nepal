// lib/constants/requestStatus.ts
import type { RequestStatus } from '../../types/database.types';

export const STATUS_STYLES: Record<RequestStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Pending' },
  quoted: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Quote sent' },
  approved: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Approved' },
  assigned: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Assigned' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'In progress' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700', label: 'Resolved' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelled' },
};
