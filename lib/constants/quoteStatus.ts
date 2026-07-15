// lib/constants/quoteStatus.ts
import type { QuoteStatus } from '../../types/database.types';

export const QUOTE_STATUS_STYLES: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Awaiting quote' },
  quoted: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Quote sent' },
  accepted: { bg: 'bg-green-50', text: 'text-green-700', label: 'Accepted' },
  declined: { bg: 'bg-red-50', text: 'text-red-600', label: 'Declined' },
};
