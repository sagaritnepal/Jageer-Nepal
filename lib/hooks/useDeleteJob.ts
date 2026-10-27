// lib/hooks/useDeleteJob.ts
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getErrorMessage, showAlert } from '../utils/alert';
import { ticketLabel } from '../utils/ticket';
import type { ServiceRequest } from '../../types/database.types';

export type DeletableRequest = Pick<
  ServiceRequest,
  'id' | 'issue_type' | 'status' | 'technician_id' | 'reseller_id' | 'payment_status' | 'amount_paid'
> & {
  ticket_no?: number | string | null;
};

/** True for a job its reseller may delete: one with no payment on it. The server decides the rest (it
 * also refuses a job that is on a bill) and says why - see delete_finished_job (migrations 0098, 0102).
 * A request nobody has claimed (no reseller) is not theirs to delete. */
export function canDeleteJob(request: Pick<ServiceRequest, 'reseller_id' | 'payment_status' | 'amount_paid'>): boolean {
  return !!request.reseller_id && request.payment_status === 'unpaid' && !(Number(request.amount_paid) > 0);
}

/** "Delete job" for a reseller, on any screen: asks "Are you sure?", then removes the job for good
 * (with its job card, chalan and chat), at any stage. Unlike Cancel, nothing is kept: a cancelled job
 * stays in the Cancelled tab with its reason, a deleted one is gone. A technician who had the job (and
 * an app customer who asked for it) is told by the database. `deletingId` is the job being deleted,
 * to disable its button. */
export function useDeleteJob() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDeleteJob = useCallback(
    (request: DeletableRequest) => {
      const heading = `${ticketLabel(request.ticket_no) ?? ''} ${request.issue_type}`.trim();
      const underWay = request.status !== 'resolved' && request.status !== 'cancelled';
      const told =
        request.technician_id && (request.status === 'assigned' || request.status === 'in_progress')
          ? ' The technician will be told.'
          : '';
      showAlert(
        'Delete this job?',
        `${heading} is removed for good, with its job card and chalan.${told} This cannot be undone.${
          underWay ? ' To keep a record of it, cancel it instead.' : ''
        }`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete job',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(request.id);
              try {
                const { error } = await (supabase as any).rpc('delete_finished_job', { p_request_id: request.id });
                if (error) throw error;
                for (const key of ['service_requests', 'customer_ledger_entries', 'job_cards', 'reward_point_events', 'profiles']) {
                  queryClient.invalidateQueries({ queryKey: [key] });
                }
              } catch (err) {
                showAlert('Could not delete the job', getErrorMessage(err));
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [queryClient]
  );

  return { confirmDeleteJob, deletingId };
}
