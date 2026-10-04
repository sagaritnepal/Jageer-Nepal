// lib/constants/push.ts

/** The PUBLIC half of the web push key pair (VAPID). A browser needs it to
 * subscribe to this app's pushes; it is meant to be public. The private half
 * lives only in the Supabase function's secrets (VAPID_PRIVATE_KEY) - see
 * supabase/functions/send-push. Changing this key invalidates every browser
 * already subscribed, so they would have to turn notifications on again. */
export const VAPID_PUBLIC_KEY = 'BKJsJGNnURbpvt5zRLRt3z5RC3i73TjfzdUsUrz_08qsh99lKXFUi38gdulfK4pTI6CyoRngAGBhN3Fp88R9zR8';

/** The service worker that receives pushes while the site is closed. It is a
 * plain file in public/, served from the site root so it can cover every page. */
export const PUSH_SERVICE_WORKER = '/sw.js';
