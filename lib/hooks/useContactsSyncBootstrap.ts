// lib/hooks/useContactsSyncBootstrap.ts
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { silentSyncIfEnabled } from '../utils/contactsSync';

const minMsBetweenSyncs = 60_000;

/** Mount once near the root (see app/_layout.tsx). If the signed-in user has
 * already opted into phone contacts sync (lib/utils/contactsSync.ts), this
 * re-runs it on cold start and every time the app returns to the
 * foreground, so a contact saved on the phone shows up next time the app is
 * opened without the user having to do anything. Never prompts for
 * permission itself - only runs once opt-in has already granted it. */
export function useContactsSyncBootstrap(userId: string | undefined) {
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);
  const lastSyncAt = useRef(0);

  function runSync() {
    if (!userId) return;
    const now = Date.now();
    if (now - lastSyncAt.current < minMsBetweenSyncs) return;
    lastSyncAt.current = now;
    silentSyncIfEnabled(userId)
      .then((synced) => {
        if (synced !== null) queryClient.invalidateQueries({ queryKey: ['customers'] });
      })
      .catch(() => {
        // Best-effort background sync - a failure here (e.g. offline) just
        // means the list stays as of the last successful sync.
      });
  }

  useEffect(() => {
    runSync();
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      appState.current = next;
      if (!wasActive && next === 'active') runSync();
    });
    return () => sub.remove();
  }, [userId]);
}
