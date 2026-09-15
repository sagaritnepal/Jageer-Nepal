// lib/utils/assignTechnician.ts
import { supabase } from '../supabase';

/** Offers a service request to a technician. Every technician - employee or
 * outsource - gets it as `assigned`, which rings on their phone/web
 * (IncomingJobOffer) until they Accept (-> `in_progress`) or Reject (back to
 * the reseller) through the technician_respond_to_job RPC.
 *
 * Deliberately does NOT open a job_cards row here: the job_cards RLS policy
 * only allows the technician themselves (or admin) to write one
 * (technician_id = auth.uid()), and this runs as the reseller. Accepting the
 * offer creates the row. */
export async function assignTechnician(params: {
  requestId: string;
  technicianId: string;
  extraValues?: Record<string, unknown>;
}): Promise<void> {
  const { requestId, technicianId, extraValues } = params;

  // Cast to `any`: same postgrest-js generic-inference gap noted in
  // lib/utils/contactsSync.ts (see useSupabase.ts for the pattern).
  const { error } = await (supabase.from('service_requests') as any)
    .update({
      technician_id: technicianId,
      status: 'assigned',
      ...extraValues,
    })
    .eq('id', requestId);
  if (error) throw error;
}
