// lib/hooks/useNotifications.ts
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useSupabaseQuery } from './useSupabase';
import type { AppNotification } from '../../types/database.types';

// The database keeps 30 days; the app shows the latest of them.
const MAX_SHOWN = 50;

/** The signed-in person's notifications, newest first. The database writes
 * them (migration 0082) whenever a technician accepts, declines or finishes a
 * job, records a payment, and so on - or a reseller cancels work - so they are
 * still here if the app was closed when it happened. `unread` is what the bell
 * counts.
 *
 * The list refreshes on a slow poll as a safety net; NotificationPopup (mounted
 * once per portal) also refetches it the instant a new row arrives. If the
 * table does not exist yet (migration not run) the query just errors, and
 * everything here reads as "no notifications" - nothing breaks. */
export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data, isError } = useSupabaseQuery('notifications', {
    filters: userId ? { user_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
    queryOptions: {
      retry: 1,
      refetchInterval: (query) => (query.state.status === 'error' ? false : 15_000),
    },
  });

  const items = useMemo<AppNotification[]>(() => (data ?? []).slice(0, MAX_SHOWN), [data]);
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!userId || (ids && ids.length === 0)) return;
      let query = (supabase.from('notifications') as any)
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (ids) query = query.in('id', ids);
      const { error } = await query;
      if (!error) queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [userId, queryClient]
  );

  const clearAll = useCallback(async () => {
    if (!userId) return;
    const { error } = await (supabase.from('notifications') as any).delete().eq('user_id', userId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [userId, queryClient]);

  return {
    items,
    unread,
    /** True once the first fetch has come back (not while loading, or if it failed). */
    loaded: data !== undefined,
    failed: isError,
    /** Marks the given ones (or, with no argument, all of them) as read. */
    markRead,
    /** Removes all of this person's notifications. */
    clearAll,
  };
}
