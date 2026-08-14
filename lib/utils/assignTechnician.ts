// lib/utils/assignTechnician.ts
import { supabase } from '../supabase';

/** Assigns a technician to a service request. An employee technician skips
 * the accept step entirely - the job goes straight to `in_progress` since
 * they're already committed to their employer. An outsource technician
 * still goes to `assigned` and must tap "Start job" themselves to accept
 * it.
 *
 * Deliberately does NOT open a job_cards row here even for employees: the
 * job_cards RLS policy only allows the technician themselves (or admin) to
 * write one (technician_id = auth.uid()), and this runs as the reseller.
 * app/(technician)/job/[id].tsx already creates the row lazily - the same
 * fallback it uses for older data with no row yet - the first time the
 * technician marks the job resolved, so nothing is lost by skipping it
 * here. */
export async function assignTechnician(params: {
  requestId: string;
  technicianId: string;
  isEmployee: boolean;
  extraValues?: Record<string, unknown>;
}): Promise<void> {
  const { requestId, technicianId, isEmployee, extraValues } = params;

  // Cast to `any`: same postgrest-js generic-inference gap noted in
  // lib/utils/contactsSync.ts (see useSupabase.ts for the pattern).
  const { error } = await (supabase.from('service_requests') as any)
    .update({
      technician_id: technicianId,
      status: isEmployee ? 'in_progress' : 'assigned',
      ...extraValues,
    })
    .eq('id', requestId);
  if (error) throw error;
}
