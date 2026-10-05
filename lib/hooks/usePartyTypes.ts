// lib/hooks/usePartyTypes.ts
import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useSupabaseDelete, useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from './useSupabase';

/** What a reseller starts with. They are ordinary rows once created, so every
 * one of them can be renamed or deleted like a type the reseller added. */
const STARTER_PARTY_TYPES = ['Customer', 'Vendor', 'Employee'];

/**
 * A reseller's own list of party types (0084_party_types.sql): read, add,
 * rename, delete. The first time a reseller with no types opens it, the three
 * starter types are filled in (upserted by name, so two screens asking at once
 * can't create duplicates).
 *
 * `available` is false when the table can't be read - e.g. the migration has
 * not been run yet - so screens can leave the type field out instead of
 * breaking the page around it.
 */
export function usePartyTypes(userId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useSupabaseQuery('party_types', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'created_at' },
    enabled: !!userId,
    queryOptions: { retry: false },
  });
  const createType = useSupabaseInsert('party_types');
  const updateType = useSupabaseUpdate('party_types');
  const deleteType = useSupabaseDelete('party_types');

  const seeded = useRef(false);
  const types = query.data ?? [];
  useEffect(() => {
    if (!userId || !query.isSuccess || types.length > 0 || seeded.current) return;
    seeded.current = true;
    (supabase.from('party_types') as any)
      .upsert(
        STARTER_PARTY_TYPES.map((name) => ({ owner_id: userId, name })),
        { onConflict: 'owner_id,name', ignoreDuplicates: true }
      )
      .then(({ error }: { error: unknown }) => {
        if (!error) queryClient.invalidateQueries({ queryKey: ['party_types'] });
      });
  }, [userId, query.isSuccess, types.length, queryClient]);

  const nameById = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);

  async function create(name: string) {
    if (!userId) throw new Error('Not signed in');
    return createType.mutateAsync({ owner_id: userId, name: name.trim() });
  }
  async function rename(id: string, name: string) {
    await updateType.mutateAsync({ id, values: { name: name.trim() } });
  }
  async function remove(id: string) {
    await deleteType.mutateAsync(id);
  }

  return { types, nameById, available: !query.isError, create, rename, remove };
}
