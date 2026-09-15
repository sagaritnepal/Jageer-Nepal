// lib/hooks/useJobOffers.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useSupabaseQuery, subscribeToTable } from './useSupabase';

/** Jobs currently offered to this technician (status 'assigned'), oldest
 * first. Refreshes the moment a reseller offers or withdraws a job via
 * realtime, with a slow poll as a safety net in case the live connection
 * drops. */
export function useJobOffers(technicianId: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useSupabaseQuery('service_requests', {
    filters: technicianId ? { technician_id: technicianId, status: 'assigned' } : {},
    orderBy: { column: 'created_at', ascending: true },
    enabled: !!technicianId,
    queryOptions: { refetchInterval: 20_000 },
  });

  useEffect(() => {
    if (!technicianId) return;
    return subscribeToTable(
      'service_requests',
      () => queryClient.invalidateQueries({ queryKey: ['service_requests'] }),
      `technician_id=eq.${technicianId}`
    );
  }, [technicianId, queryClient]);

  return data ?? [];
}

/** Accept starts the job and opens its job card; reject hands it back to the
 * reseller. Runs as one server-side transaction (migration 0071). */
export async function respondToJobOffer(requestId: string, accept: boolean) {
  const { error } = await (supabase as any).rpc('technician_respond_to_job', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

/** Undo a mistaken "complete" while the job is still unpaid - also takes back
 * the reward points completion gave out (migration 0071). */
export async function reopenCompletedJob(requestId: string) {
  const { error } = await (supabase as any).rpc('reopen_completed_job', { p_request_id: requestId });
  if (error) throw error;
}
