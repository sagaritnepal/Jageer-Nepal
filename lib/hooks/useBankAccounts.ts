// lib/hooks/useBankAccounts.ts
import { useSupabaseDelete, useSupabaseInsert, useSupabaseQuery, useSupabaseUpdate } from './useSupabase';

export interface BankAccountDetails {
  name: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  address: string | null;
}

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

  async function create(details: BankAccountDetails) {
    if (!userId) throw new Error('Not signed in');
    await createAccount.mutateAsync({ owner_id: userId, ...details });
  }
  async function update(id: string, details: Partial<BankAccountDetails>) {
    await updateAccount.mutateAsync({ id, values: details });
  }
  // Only the picker's inline rename still needs this narrow form - the full
  // edit screen uses `update` directly with every field.
  async function rename(id: string, name: string) {
    await update(id, { name });
  }
  async function remove(id: string) {
    await deleteAccount.mutateAsync(id);
  }

  return { accounts: accounts ?? [], create, update, rename, remove };
}
