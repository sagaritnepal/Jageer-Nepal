// lib/hooks/usePushNotifications.web.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { PUSH_SERVICE_WORKER, VAPID_PUBLIC_KEY } from '../constants/push';
import type { PushController, PushStatus } from './pushTypes';

function isIos(): boolean {
  const ua = navigator.userAgent;
  // An iPad asking for the desktop site reports itself as a Mac with a touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalledApp(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

function canReceivePush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The browser wants the key as raw bytes; it is stored as URL-safe base64. */
function keyToBytes(base64Url: string): Uint8Array {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function saveToServer(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const { error } = await (supabase as any).rpc('register_push_subscription', {
    p_channel: 'web',
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh ?? null,
    p_auth: json.keys?.auth ?? null,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(PUSH_SERVICE_WORKER);
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Turns push notifications on for this browser: asks permission, subscribes it
 * to the browser's push service with the app's key, and tells the server which
 * address to send to. On an iPhone this only works for the site added to the
 * Home Screen (a normal Safari tab has no push at all). */
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
      if (!canReceivePush()) return set(isIos() && !isInstalledApp() ? 'needs-install' : 'unsupported');
      if (Notification.permission === 'denied') return set('blocked');
      try {
        // Registered up front so it is ready the moment someone turns notifications on.
        await navigator.serviceWorker.register(PUSH_SERVICE_WORKER);
        const subscription = await currentSubscription();
        if (Notification.permission === 'granted' && subscription) {
          // Already on here: tell the server again, so a device that changed hands
          // follows the person now signed in and the "last seen" stays fresh.
          await saveToServer(subscription).catch(() => {});
          return set('on');
        }
        set('off');
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
      if (!canReceivePush()) throw new Error('This browser cannot receive notifications.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER);
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      await saveToServer(subscription);
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
      const subscription = await currentSubscription();
      if (subscription) {
        await (supabase as any).rpc('unregister_push_subscription', { p_endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus('off');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not turn notifications off.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable };
}

/** Called on sign-out so the next person on this browser does not receive the
 * last person's pushes. The browser keeps its subscription, so the same person
 * signing back in is switched on again automatically. Never blocks the sign-out. */
export async function unregisterThisDevice(): Promise<void> {
  try {
    if (!canReceivePush()) return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    await Promise.race([
      (supabase as any).rpc('unregister_push_subscription', { p_endpoint: subscription.endpoint }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Offline or already signed out: nothing more to do.
  }
}
