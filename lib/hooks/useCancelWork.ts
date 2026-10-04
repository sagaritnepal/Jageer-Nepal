// lib/hooks/useCancelWork.ts
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseUpdate } from './useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';
import type { ServiceRequest } from '../../types/database.types';

type CancellableRequest = Pick<ServiceRequest, 'id' | 'issue_type' | 'status' | 'technician_id' | 'reseller_id'>;

// Every stage before the job is finished. The database allows a reseller to
// cancel their own job from any of these (migration 0077); a finished job has
// been done and is paid for, not cancelled.
const CANCELLABLE: ServiceRequest['status'][] = ['pending', 'quoted', 'approved', 'assigned', 'in_progress'];

/** True for a job its reseller has taken on and that is not finished yet. A
 * request nobody has claimed (no reseller) is not theirs to cancel. */
export function canCancelWork(request: Pick<ServiceRequest, 'status' | 'reseller_id'>): boolean {
  return !!request.reseller_id && CANCELLABLE.includes(request.status);
}

/** "Cancel work" for a reseller, on any screen: asks "Are you sure?" and only
 * then marks the job cancelled. A technician who has been given the job (or
 * started it) is told straight away - the database adds that notification
 * (migration 0082). `busyId` is the job being cancelled, to disable its button. */
export function useCancelWork() {
  const updateRequest = useSupabaseUpdate('service_requests');
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmCancelWork = useCallback(
    (request: CancellableRequest) => {
      const technicianToldNote =
        request.technician_id && (request.status === 'assigned' || request.status === 'in_progress')
          ? ' The technician will be told right away.'
          : '';
      showAlert(
        'Cancel this work?',
        `Are you sure you want to cancel "${request.issue_type}"?${technicianToldNote} This cannot be undone.`,
        [
          { text: 'No, keep it', style: 'cancel' },
          {
            text: 'Yes, cancel work',
            style: 'destructive',
            onPress: async () => {
              setBusyId(request.id);
              try {
                await updateRequest.mutateAsync({ id: request.id, values: { status: 'cancelled' } });
                await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
              } catch (err) {
                showAlert('Could not cancel the work', getErrorMessage(err));
              } finally {
                setBusyId(null);
              }
            },
          },
        ]
      );
    },
    [updateRequest, queryClient]
  );

  return { confirmCancelWork, busyId };
}
