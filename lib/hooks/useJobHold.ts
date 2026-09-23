// lib/hooks/useJobHold.ts
import { supabase } from '../supabase';

/** Technician asks to pause an in-progress job, with a note the reseller
 * sees. Fails server-side unless the job is in_progress and has no hold
 * already pending/active (migration 0076). */
export async function requestJobHold(requestId: string, note: string) {
  const { error } = await (supabase as any).rpc('request_job_hold', {
    p_request_id: requestId,
    p_note: note,
  });
  if (error) throw error;
}

/** Reseller accepts (job goes on_hold) or rejects (hold clears, job carries
 * on as normal) a pending hold request (migration 0076). */
export async function respondToJobHold(requestId: string, approve: boolean) {
  const { error } = await (supabase as any).rpc('respond_to_job_hold', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}

/** Technician resumes work on their own job once it's on_hold - no further
 * reseller approval needed (migration 0076). */
export async function resumeJobHold(requestId: string) {
  const { error } = await (supabase as any).rpc('resume_job_hold', { p_request_id: requestId });
  if (error) throw error;
}
