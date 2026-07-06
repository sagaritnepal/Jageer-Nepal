// lib/hooks/useSupabase.ts
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/database.types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];

interface QueryFilters {
  [column: string]: string | number | boolean | null;
}

/**
 * Generic read hook for any table, with optional equality filters.
 *
 * Example:
 *   const { data, isLoading } = useSupabaseQuery('service_requests', {
 *     filters: { client_id: userId },
 *   });
 */
export function useSupabaseQuery<T extends TableName>(
  table: T,
  options?: {
    filters?: QueryFilters;
    columns?: string;
    orderBy?: { column: string; ascending?: boolean };
    enabled?: boolean;
    queryOptions?: Omit<UseQueryOptions<Row<T>[]>, 'queryKey' | 'queryFn'>;
  }
) {
  const { filters = {}, columns = '*', orderBy, enabled = true, queryOptions } = options ?? {};

  return useQuery<Row<T>[]>({
    queryKey: [table, filters, orderBy],
    enabled,
    queryFn: async () => {
      // Cast to `any` here: postgrest-js's `.select()`/`.eq()` overloads resolve
      // their column/query types from a literal table name, which breaks down
      // when `table` is itself a generic parameter. The hand-written `Row<T>`
      // cast below is what actually keeps this hook's return type safe.
      let query = (supabase.from(table) as any).select(columns);

      for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column, value);
      }
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row<T>[];
    },
    ...queryOptions,
  });
}

/** Fetch a single row by id. */
export function useSupabaseRow<T extends TableName>(table: T, id: string | undefined, columns = '*') {
  return useQuery<Row<T> | null>({
    queryKey: [table, 'row', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from(table) as any).select(columns).eq('id', id!).single();
      if (error) throw error;
      return data as Row<T>;
    },
  });
}

/** Insert a row and invalidate that table's queries on success. */
export function useSupabaseInsert<T extends TableName>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Insert<T>) => {
      const { data, error } = await (supabase.from(table) as any).insert(values).select().single();
      if (error) throw error;
      return data as Row<T>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/** Update a row by id and invalidate that table's queries on success. */
export function useSupabaseUpdate<T extends TableName>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Update<T> }) => {
      const { data, error } = await (supabase.from(table) as any).update(values).eq('id', id).select().single();
      if (error) throw error;
      return data as Row<T>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/**
 * Delete a row by id and invalidate that table's queries on success.
 *
 * NOTE: this only deletes the database row (e.g. a `profiles` row). It does
 * NOT delete the corresponding Supabase Auth user — that requires the
 * service_role key via the Auth Admin API, which must never ship inside a
 * client app (anyone could extract it and bypass all your RLS policies).
 * To support true account deletion, add a Supabase Edge Function that runs
 * server-side with the service_role key and call it from here instead.
 */
export function useSupabaseDelete<T extends TableName>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(table) as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/**
 * Subscribe to realtime changes on a table (optionally filtered), invalidating
 * the matching React Query cache whenever a row changes. Use inside a
 * useEffect in screens that need live updates (e.g. client issue tracking).
 */
export function subscribeToTable(table: TableName, onChange: () => void, filter?: string) {
  const channel = supabase
    .channel(`realtime:${table}:${filter ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Convenience hook: subscribes to realtime changes on a table and
 * automatically invalidates the matching React Query cache key.
 *
 * Example (client issue tracking screen):
 *   useRealtimeSync('service_requests', `client_id=eq.${userId}`, { client_id: userId });
 */
export function useRealtimeSync<T extends TableName>(table: T, filter: string | undefined, queryKeyFilters: QueryFilters) {
  const queryClient = useQueryClient();
  return () =>
    subscribeToTable(
      table,
      () => queryClient.invalidateQueries({ queryKey: [table, queryKeyFilters] }),
      filter
    );
}
