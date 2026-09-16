// lib/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

// Exported so sign-out (see useAuth.ts) can purge every cached query on the
// way out - without this, a second account signing in on the same device
// would briefly render the previous user's cached profiles/requests/ledger
// data before its own queries refetch.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// React Query's "refetch on focus" only fires automatically on web (it
// listens for the browser's `visibilitychange`/`focus` events, which don't
// exist on native). Without this, a reseller who backgrounds the app to
// take a phone call - or a technician who switches to Maps and back - comes
// back to a Requests/Jobs list frozen at whatever it looked like when they
// left, with no pull-to-refresh anywhere in the app to fall back on. Wiring
// AppState to focusManager makes every screen's query refetch (once it's
// past its 30s staleTime) the moment the app is foregrounded again, on iOS
// and Android both - the same "come back and it's current" behavior the web
// build already gets for free.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

AppState.addEventListener('change', onAppStateChange);

export function QueryProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
