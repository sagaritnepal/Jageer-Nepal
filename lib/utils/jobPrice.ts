// lib/utils/jobPrice.ts
import type { ServiceRequest } from '../../types/database.types';

/** Whether the reseller can change this job's price from the table.
 *
 * It mirrors the database rule (service_requests_guard_update, migration 0077) so the pencil only
 * shows where the save will go through: only the job's own reseller, never once it is paid or
 * cancelled, and an app customer's quote is theirs to approve - it can only change while the job is
 * still pending. A walk-in job (origin 'reseller') can change at any stage before it is paid. */
export function canEditJobPrice(
  request: Pick<ServiceRequest, 'reseller_id' | 'origin' | 'status' | 'payment_status'>,
  userId: string | null | undefined
): boolean {
  if (!userId || request.reseller_id !== userId) return false;
  if (request.payment_status === 'paid' || request.status === 'cancelled') return false;
  if (request.origin === 'app' && request.status !== 'pending') return false;
  return true;
}
