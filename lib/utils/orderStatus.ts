// lib/utils/orderStatus.ts
import type { OrderStatus } from '../../types/database.types';

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

export const STATUS_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirm order',
  confirmed: 'Mark shipped',
  shipped: 'Mark delivered',
};

export const STATUS_BADGE_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
