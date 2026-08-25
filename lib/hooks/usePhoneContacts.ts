// lib/hooks/usePhoneContacts.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
// The default 'expo-contacts' export's getContactsAsync/requestPermissionsAsync
// are deprecated in favor of a new class-based API and now throw instead of
// just warning ("Method getContactsAsync ... is deprecated") - that's why
// every phone contact was silently coming back empty. The legacy import
// keeps the same function-based API this file is written against.
import * as Contacts from 'expo-contacts/legacy';
import { normalizePhone } from '../utils/phone';

export interface PhoneContactEntry {
  name: string;
  phone: string;
}

// Module-level, not component state: every customer-name field across the
// app shares one read of the phone's contact list for the whole session,
// instead of each field re-requesting permission and re-scanning hundreds
// of contacts on its own first focus.
let cache: PhoneContactEntry[] | null = null;
let cacheError: string | null = null;
let inFlight: Promise<void> | null = null;
let rawTotal = 0;
let skippedNoPhone = 0;

async function loadContacts(): Promise<void> {
  if (cache || cacheError) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        cacheError = `Contacts permission not granted (status: ${status})`;
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      rawTotal = data?.length ?? 0;
      const seen = new Set<string>();
      const result: PhoneContactEntry[] = [];
      for (const contact of data ?? []) {
        const name = contact.name?.trim();
        const rawPhone = contact.phoneNumbers?.[0]?.number;
        const phone = rawPhone ? normalizePhone(rawPhone) : null;
        if (!name || !phone) {
          skippedNoPhone++;
          continue;
        }
        if (seen.has(phone)) continue;
        seen.add(phone);
        result.push({ name, phone });
      }
      result.sort((a, b) => a.name.localeCompare(b.name));
      cache = result;
    } catch (err) {
      cacheError = err instanceof Error ? err.message : String(err);
    }
  })();
  return inFlight;
}

/** Lazily loads (and caches for the session) the phone's contact list, so a
 * customer-name field's dropdown can show/search it locally. Call
 * `request()` from an explicit action (the field's first focus) - it
 * no-ops on web and after the first successful load. */
export function usePhoneContacts() {
  const [contacts, setContacts] = useState<PhoneContactEntry[]>(cache ?? []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>(cache || cacheError ? 'done' : 'idle');
  const [error, setError] = useState<string | null>(cacheError);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cache || cacheError) {
      setContacts(cache ?? []);
      setError(cacheError);
      setStatus('done');
    }
  }, []);

  async function request() {
    if (status !== 'idle' || Platform.OS === 'web') return;
    setStatus('loading');
    await loadContacts();
    setContacts(cache ?? []);
    setError(cacheError);
    setDebugInfo(`raw=${rawTotal} usable=${cache?.length ?? 0} skipped=${skippedNoPhone}`);
    setStatus('done');
  }

  return { contacts, request, status, error, debugInfo };
}
