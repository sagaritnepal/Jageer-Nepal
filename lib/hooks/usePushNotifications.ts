// lib/hooks/usePushNotifications.ts
//
// The fallback for a platform with neither file next to it: nothing can be pushed.
// The real ones are usePushNotifications.web.ts (a service worker + the browser's
// push service) and usePushNotifications.native.ts (Expo's push service) - the
// bundler picks the right one for the platform.
import type { PushController } from './pushTypes';

export function usePushNotifications(_userId: string | undefined): PushController {
  return { status: 'unsupported', busy: false, error: null, enable: async () => {}, disable: async () => {} };
}

/** Called on sign-out so the next person on this device does not receive the last person's pushes. */
export async function unregisterThisDevice(): Promise<void> {}
