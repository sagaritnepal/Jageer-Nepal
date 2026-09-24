// lib/hooks/useFormDraft.ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type StoredDraft<T> = { values: T; savedAt: string };

const PREFIX = 'form-draft:';

/** Unfinished form edits kept on this device under `key`, so leaving a
 * half-edited form (back button, another tab, closing the app) doesn't lose
 * them. `loaded` flips once storage has been read - wait for it before
 * deciding what the form starts from. Storage failures are swallowed: a
 * draft is a convenience, never something a save should fail over. */
export function useFormDraft<T>(key: string | null) {
  const [draft, setDraft] = useState<StoredDraft<T> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setDraft(null);
    if (!key) return;
    AsyncStorage.getItem(PREFIX + key)
      .then((raw) => {
        if (!cancelled) setDraft(raw ? (JSON.parse(raw) as StoredDraft<T>) : null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const saveDraft = useCallback(
    async (values: T) => {
      if (!key) return;
      const next = { values, savedAt: new Date().toISOString() };
      setDraft(next);
      try {
        await AsyncStorage.setItem(PREFIX + key, JSON.stringify(next));
      } catch {}
    },
    [key]
  );

  const clearDraft = useCallback(async () => {
    if (!key) return;
    setDraft(null);
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  }, [key]);

  return { draft, loaded, saveDraft, clearDraft };
}

/** "2:14 PM" today, "Sep 24, 2:14 PM" otherwise. */
export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}
