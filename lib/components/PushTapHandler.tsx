// lib/components/PushTapHandler.tsx
//
// Opens the right screen when someone taps a push notification on a phone. Only the
// phone build needs it (PushTapHandler.native.tsx): on the web, the service worker
// (public/sw.js) opens the notifications page itself.
export function PushTapHandler() {
  return null;
}
