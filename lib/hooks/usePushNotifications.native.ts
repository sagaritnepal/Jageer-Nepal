// lib/hooks/usePushNotifications.native.ts
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../supabase';
import type { PushController, PushStatus } from './pushTypes';

// With the app open, the in-app pop-up (NotificationPopup and the older notices)
// already shows the news, so the system does not also drop a banner on top of it;
// it still goes into the notification list.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Android 13+ will not even ask for permission until a channel exists. The id is
 * the one the server names in every push (supabase/functions/_shared/push.ts). */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Jageer Nepal',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  });
}

/** Expo Go on Android no longer receives remote pushes (SDK 53+): it needs a development or release build. */
function runningInExpoGoOnAndroid(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function getPushToken(): Promise<string> {
  await ensureAndroidChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('This build is missing its Expo project id.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

async function saveToServer(token: string): Promise<void> {
  const { error } = await (supabase as any).rpc('register_push_subscription', {
    p_channel: 'expo',
    p_endpoint: token,
    p_user_agent: `${Platform.OS} ${Platform.Version}`,
  });
  if (error) throw error;
}

/** Turns push notifications on for this phone: asks permission, gets the phone's
 * Expo push token and tells the server to send to it. */
export function usePushNotifications(userId: string | undefined): PushController {
  const [status, setStatus] = useState<PushStatus>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const set = (next: PushStatus) => {
      if (!cancelled) setStatus(next);
    };

    (async () => {
      if (runningInExpoGoOnAndroid()) return set('unsupported');
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.granted) {
          // Already allowed: make sure the server has this phone for the person signed in now.
          await saveToServer(await getPushToken()).catch(() => {});
          return set('on');
        }
        set(permission.canAskAgain ? 'off' : 'blocked');
      } catch {
        set('unsupported');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureAndroidChannel();
      const permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (!permission.granted) {
        setStatus(permission.canAskAgain ? 'off' : 'blocked');
        return;
      }
      await saveToServer(await getPushToken());
      setStatus('on');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not turn notifications on. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getPushToken();
      await (supabase as any).rpc('unregister_push_subscription', { p_endpoint: token });
      setStatus('off');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not turn notifications off.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable };
}

/** Called on sign-out so the next person on this phone does not receive the last
 * person's pushes. Signing back in registers the phone again. Never blocks the sign-out. */
export async function unregisterThisDevice(): Promise<void> {
  try {
    if (runningInExpoGoOnAndroid()) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const token = await getPushToken();
    await Promise.race([
      (supabase as any).rpc('unregister_push_subscription', { p_endpoint: token }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Offline, or the phone never had a token: nothing more to do.
  }
}
