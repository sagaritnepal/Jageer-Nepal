// lib/hooks/useTechnicianEmployment.ts
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate } from './useSupabase';
import type { Profile, TechnicianEmployment } from '../../types/database.types';

/** A technician's own employment request/status - at most one active
 * (pending or accepted) row exists per technician at a time (see the
 * migration's partial unique index), older rejected/ended rows are just
 * history. */
export function useMyEmployment(technicianId: string | undefined) {
  const { data: rows, ...rest } = useSupabaseQuery('technician_employment', {
    filters: technicianId ? { technician_id: technicianId } : {},
    orderBy: { column: 'requested_at', ascending: false },
    enabled: !!technicianId,
  });

  const current = useMemo(
    () => (rows ?? []).find((r) => r.status === 'pending' || r.status === 'accepted') ?? null,
    [rows]
  );
  const { data: employer } = useSupabaseQuery('profiles', {
    filters: current ? { id: current.reseller_id } : {},
    enabled: !!current,
  });

  return { current, employer: employer?.[0] ?? null, ...rest };
}

interface EmploymentWithProfile {
  employment: TechnicianEmployment;
  profile: Profile;
}

function useJoinedTechnicianEmployment(
  resellerId: string | undefined,
  status: TechnicianEmployment['status']
) {
  const { data: rows, isLoading } = useSupabaseQuery('technician_employment', {
    filters: resellerId ? { reseller_id: resellerId, status } : {},
    orderBy: { column: 'requested_at', ascending: false },
    enabled: !!resellerId,
  });

  const technicianIds = useMemo(() => (rows ?? []).map((r) => r.technician_id), [rows]);

  const { data: profiles } = useQuery({
    queryKey: ['technician-employment-profiles', technicianIds],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').in('id', technicianIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: technicianIds.length > 0,
  });

  const joined = useMemo((): EmploymentWithProfile[] => {
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? [])
      .map((employment) => {
        const profile = byId.get(employment.technician_id);
        return profile ? { employment, profile } : null;
      })
      .filter((x): x is EmploymentWithProfile => x !== null);
  }, [rows, profiles]);

  return { data: joined, isLoading };
}

/** Pending applications a reseller has received from technicians. */
export function usePendingHires(resellerId: string | undefined) {
  return useJoinedTechnicianEmployment(resellerId, 'pending');
}

/** A reseller's currently-accepted employee technicians. */
export function useMyEmployees(resellerId: string | undefined) {
  return useJoinedTechnicianEmployment(resellerId, 'accepted');
}

export function useApplyToReseller() {
  const insert = useSupabaseInsert('technician_employment');
  return {
    ...insert,
    apply: (params: {
      technicianId: string;
      resellerId: string;
      workStartTime: string;
      workEndTime: string;
    }) =>
      insert.mutateAsync({
        technician_id: params.technicianId,
        reseller_id: params.resellerId,
        status: 'pending',
        work_start_time: params.workStartTime,
        work_end_time: params.workEndTime,
      }),
  };
}

export function useRespondToHire() {
  const update = useSupabaseUpdate('technician_employment');
  return {
    ...update,
    respond: (id: string, accept: boolean) =>
      update.mutateAsync({ id, values: { status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() } }),
  };
}

export function useEndEmployment() {
  const update = useSupabaseUpdate('technician_employment');
  return {
    ...update,
    end: (id: string) => update.mutateAsync({ id, values: { status: 'ended', ended_at: new Date().toISOString() } }),
  };
}

export function useUpdateWorkHours() {
  const update = useSupabaseUpdate('technician_employment');
  return {
    ...update,
    updateHours: (id: string, workStartTime: string, workEndTime: string) =>
      update.mutateAsync({ id, values: { work_start_time: workStartTime, work_end_time: workEndTime } }),
  };
}

/** Look up a reseller by phone, for a technician applying to work for them. */
export function useFindResellerByPhone() {
  const queryClient = useQueryClient();
  return async (phone: string): Promise<Profile | null> => {
    const { data, error } = await (supabase.from('profiles') as any)
      .select('*')
      .eq('role', 'reseller')
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    if (data) queryClient.setQueryData(['profiles', 'row', data.id], data);
    return data as Profile | null;
  };
}
