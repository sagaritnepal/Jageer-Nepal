// lib/hooks/useBankAccounts.ts
import { useSupabaseDelete, useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from './useSupabase';

/**
 * Shared CRUD wiring for a business's bank accounts - used by both the
 * inline picker in the transaction form and the standalone management
 * screen reachable from the Finance tab, so both stay in sync automatically
 * (same React Query cache key) without duplicating the mutation logic.
 */
export function useBankAccounts(userId: string | undefined) {
  const { data: accounts } = useSupabaseQuery('bank_accounts', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const createAccount = useSupabaseInsert('bank_accounts');
  const updateAccount = useSupabaseUpdate('bank_accounts');
  const deleteAccount = useSupabaseDelete('bank_accounts');

  async function create(name: string) {
    if (!userId) throw new Error('Not signed in');
    await createAccount.mutateAsync({ owner_id: userId, name });
  }
  async function rename(id: string, name: string) {
    await updateAccount.mutateAsync({ id, values: { name } });
  }
  async function remove(id: string) {
    await deleteAccount.mutateAsync(id);
  }

  return { accounts: accounts ?? [], create, rename, remove };
}
