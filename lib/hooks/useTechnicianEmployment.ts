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

  // A pending row the reseller started is an invite, not the technician's own
  // application - that is listed separately (useMyInvites) for accept/decline.
  const current = useMemo(
    () =>
      (rows ?? []).find(
        (r) => r.status === 'accepted' || (r.status === 'pending' && r.initiated_by !== 'reseller')
      ) ?? null,
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
  status: TechnicianEmployment['status'],
  initiatedBy?: TechnicianEmployment['initiated_by']
) {
  const { data: rows, isLoading } = useSupabaseQuery('technician_employment', {
    filters: resellerId ? { reseller_id: resellerId, status, ...(initiatedBy ? { initiated_by: initiatedBy } : {}) } : {},
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
  return useJoinedTechnicianEmployment(resellerId, 'pending', 'technician');
}

/** Invites a reseller has sent that the technician hasn't answered yet. */
export function useSentInvites(resellerId: string | undefined) {
  return useJoinedTechnicianEmployment(resellerId, 'pending', 'reseller');
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

/** A reseller invites a technician; the technician accepts or declines. */
export function useInviteTechnician() {
  const insert = useSupabaseInsert('technician_employment');
  return {
    ...insert,
    invite: (params: { technicianId: string; resellerId: string; workStartTime: string; workEndTime: string }) =>
      insert.mutateAsync({
        technician_id: params.technicianId,
        reseller_id: params.resellerId,
        status: 'pending',
        initiated_by: 'reseller',
        work_start_time: params.workStartTime,
        work_end_time: params.workEndTime,
      }),
  };
}

/** Invites a technician has received from resellers, with who sent each. */
export function useMyInvites(technicianId: string | undefined) {
  const { data: rows, isLoading } = useSupabaseQuery('technician_employment', {
    filters: technicianId ? { technician_id: technicianId, status: 'pending', initiated_by: 'reseller' } : {},
    orderBy: { column: 'requested_at', ascending: false },
    enabled: !!technicianId,
  });
  const resellerIds = useMemo(() => (rows ?? []).map((r) => r.reseller_id), [rows]);
  const { data: resellers } = useQuery({
    queryKey: ['employment-invite-resellers', resellerIds],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').in('id', resellerIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: resellerIds.length > 0,
  });
  const invites = useMemo(() => {
    const byId = new Map((resellers ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((employment) => ({ employment, reseller: byId.get(employment.reseller_id) ?? null }));
  }, [rows, resellers]);
  return { data: invites, isLoading };
}

/** Look up a technician by phone, for a reseller inviting them. */
export function useFindTechnicianByPhone() {
  return async (phone: string): Promise<Profile | null> => {
    const { data, error } = await (supabase.from('profiles') as any)
      .select('*')
      .eq('role', 'technician')
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  };
}

/** Search technicians by name or phone, for a reseller browsing for someone
 * to invite instead of typing an exact phone number. `,()%` are stripped
 * from the term first - PostgREST's `.or()` filter syntax treats them as
 * control characters, and letting a typed name reach it unescaped would let
 * someone smuggle in extra filter clauses. */
export function useSearchTechnicians(query: string) {
  const term = query.trim().replace(/[,()%]/g, '');
  return useQuery({
    queryKey: ['technician-search', term],
    queryFn: async () => {
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('role', 'technician')
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
        .order('full_name')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: term.length >= 2,
  });
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
