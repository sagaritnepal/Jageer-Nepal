// lib/hooks/useMarkJobDone.ts
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getErrorMessage, showAlert } from '../utils/alert';
import { ticketLabel } from '../utils/ticket';
import type { ServiceRequest } from '../../types/database.types';

export type DoneableRequest = Pick<ServiceRequest, 'id' | 'issue_type' | 'status' | 'technician_id' | 'reseller_id' | 'origin'> & {
  ticket_no?: number | string | null;
};

/** True for a job the reseller can mark as done: one that is under way (approved, assigned or in
 * progress), or a walk-in job of their own that was never started. An app request still waiting for
 * the customer's answer is not finished work; a finished or cancelled job has nothing left to mark.
 * The server checks the same - see mark_job_done (migration 0103). */
export function canMarkJobDone(request: Pick<ServiceRequest, 'status' | 'reseller_id' | 'origin'>): boolean {
  if (!request.reseller_id) return false;
  if (request.status === 'pending') return request.origin === 'reseller';
  return request.status === 'approved' || request.status === 'assigned' || request.status === 'in_progress';
}

/** "Mark as done" for a reseller, on any screen: for work that was finished but never completed in the
 * app because the technician does not use it. Asks "Are you sure?", then completes the job on the
 * server - it moves to Completed, ready to bill. The chalan is not asked for; it can be added on the
 * completed job. `doingId` is the job being marked, to disable its button. */
export function useMarkJobDone() {
  const queryClient = useQueryClient();
  const [doingId, setDoingId] = useState<string | null>(null);

  const confirmMarkDone = useCallback(
    (request: DoneableRequest) => {
      const heading = `${ticketLabel(request.ticket_no) ?? ''} ${request.issue_type}`.trim();
      showAlert(
        'Mark this job as done?',
        `${heading} moves to Completed, ready to bill.${
          request.technician_id ? ' The technician will not be asked to complete it.' : ''
        } The chalan number and photo can be added there afterwards.`,
        [
          { text: 'Not yet', style: 'cancel' },
          {
            text: 'Mark as done',
            onPress: async () => {
              setDoingId(request.id);
              try {
                const { error } = await (supabase as any).rpc('mark_job_done', { p_request_id: request.id });
                if (error) throw error;
                for (const key of ['service_requests', 'job_cards', 'customer_ledger_entries', 'reward_point_events', 'profiles']) {
                  queryClient.invalidateQueries({ queryKey: [key] });
                }
              } catch (err) {
                showAlert('Could not mark the job as done', getErrorMessage(err));
              } finally {
                setDoingId(null);
              }
            },
          },
        ]
      );
    },
    [queryClient]
  );

  return { confirmMarkDone, doingId };
}
