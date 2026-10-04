/* Jageer Nepal - receives push notifications while the site is closed.
 *
 * The server (supabase/functions/send-push) sends a small JSON payload:
 *   { title, body, tag, url, id, kind }
 * This file only shows it and, on a tap, opens the app. It does no caching,
 * so it never serves stale pages. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Safari (iPhone, iPad, Mac) must show something for every push or it cancels
// the subscription; Chrome and Firefox allow skipping when the app is already
// on screen, where the in-app pop-up is showing the same thing.
const isSafari = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|Edg|Firefox|FxiOS|CriOS/.test(self.navigator.userAgent);

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Jageer Nepal';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/notifications', id: payload.id || null, kind: payload.kind || null },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const onScreen = windows.some((w) => w.visibilityState === 'visible' && w.focused);
      if (onScreen && !isSafari) return undefined;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      // Reuse a window that is already open instead of piling up tabs.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          // Each step can be refused by a browser (focus without a real tap, navigating a
          // window it did not open); one refusal must not stop the others.
          try {
            await client.focus();
          } catch (error) {
            /* carry on */
          }
          try {
            if ('navigate' in client) await client.navigate(target);
          } catch (error) {
            /* focusing was enough */
          }
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
