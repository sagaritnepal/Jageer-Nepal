// lib/utils/contactsSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
// The default 'expo-contacts' export's getContactsAsync/requestPermissionsAsync
// are deprecated in favor of a new class-based API and now throw instead of
// just warning - the legacy import keeps the same function-based shape this
// file already uses (see also lib/hooks/usePhoneContacts.ts).
import * as Contacts from 'expo-contacts/legacy';
import { supabase } from '../supabase';
import { normalizePhone } from './phone';

const enabledKey = (userId: string) => `phone_contacts_sync_enabled:${userId}`;
const lastSyncedKey = (userId: string) => `phone_contacts_sync_last_at:${userId}`;

export async function isContactsSyncEnabled(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(enabledKey(userId));
  return value === 'true';
}

export async function setContactsSyncEnabled(userId: string, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(enabledKey(userId), enabled ? 'true' : 'false');
}

export async function getLastSyncedAt(userId: string): Promise<Date | null> {
  const value = await AsyncStorage.getItem(lastSyncedKey(userId));
  return value ? new Date(value) : null;
}

/** Pulls every phone contact that has at least one usable 10-digit number
 * and upserts it into `customers`, keyed by primary key `id` (resolved
 * below) so repeat syncs update the same row instead of duplicating it.
 * The phone contact always wins for name/phone on rows it owns - it never
 * touches customers added by hand that don't match by phone_contact_id or
 * phone (those keep phone_contact_id = null). */
export async function syncPhoneContactsToCustomers(ownerId: string): Promise<number> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
  });

  const candidates = (data ?? [])
    .map((contact) => {
      const rawPhone = contact.phoneNumbers?.[0]?.number;
      const phone = rawPhone ? normalizePhone(rawPhone) : null;
      const name = contact.name?.trim();
      if (!contact.id || !name || !phone) return null;
      return { phone_contact_id: contact.id, name, phone };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (candidates.length === 0) {
    await AsyncStorage.setItem(lastSyncedKey(ownerId), new Date().toISOString());
    return 0;
  }

  // A customer can already exist under this owner keyed by either column -
  // matched previously by phone_contact_id, or added by hand/via a request
  // with the same phone number. Resolving both up front and upserting on
  // the primary key (rather than a fixed onConflict column) means a single
  // phone-number collision with a hand-added customer can never abort the
  // whole batch the way onConflict: 'owner_id,phone_contact_id' could, since
  // that left the separate (owner_id, phone) unique index free to reject
  // the insert outright.
  // Cast to `any`: same postgrest-js generic-inference gap as the upsert
  // below - a partial-column `.select()` string can't be resolved against
  // the generic `Database['public']['Tables']['customers']['Row']` type.
  const { data: existing, error: fetchError } = await (supabase.from('customers') as any)
    .select('id, phone, phone_contact_id')
    .eq('owner_id', ownerId);
  if (fetchError) throw fetchError;

  const existingRows = (existing ?? []) as { id: string; phone: string | null; phone_contact_id: string | null }[];
  const byPhoneContactId = new Map(existingRows.filter((c) => c.phone_contact_id).map((c) => [c.phone_contact_id as string, c.id]));
  const byPhone = new Map(existingRows.filter((c) => c.phone).map((c) => [c.phone as string, c.id]));

  const rows = candidates.map((c) => {
    const existingId = byPhoneContactId.get(c.phone_contact_id) ?? byPhone.get(c.phone);
    return {
      ...(existingId ? { id: existingId } : {}),
      owner_id: ownerId,
      phone_contact_id: c.phone_contact_id,
      name: c.name,
      phone: c.phone,
      updated_at: new Date().toISOString(),
    };
  });

  // Cast to `any`: postgrest-js can't infer a precise Insert[] shape here
  // since `Database['public']['Tables']['customers']['Insert']` is a bare
  // `Partial<Customer>` (see useSupabase.ts for the same pattern).
  const { error } = await (supabase.from('customers') as any).upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  await AsyncStorage.setItem(lastSyncedKey(ownerId), new Date().toISOString());
  return rows.length;
}

/** Requests contacts permission (if not already granted) and runs a sync.
 * Call this from an explicit user action (e.g. a "Sync phone contacts"
 * button) - the OS permission prompt should always follow user intent. */
export async function requestAndSyncPhoneContacts(ownerId: string): Promise<{ granted: boolean; synced: number }> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { granted: false, synced: 0 };
  const synced = await syncPhoneContactsToCustomers(ownerId);
  await setContactsSyncEnabled(ownerId, true);
  return { granted: true, synced };
}

/** Silent sync for app-foreground/cold-start bootstrap: only runs if the
 * user has already opted in once (via requestAndSyncPhoneContacts) and the
 * OS permission is still granted, so it never surprises the user with a
 * permission prompt on its own. */
export async function silentSyncIfEnabled(ownerId: string): Promise<number | null> {
  const enabled = await isContactsSyncEnabled(ownerId);
  if (!enabled) return null;
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') return null;
  return syncPhoneContactsToCustomers(ownerId);
}
