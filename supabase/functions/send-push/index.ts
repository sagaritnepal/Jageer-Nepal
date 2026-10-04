// Delivers one notification as a push to every device its recipient has switched
// notifications on for. Called by the database (migration 0084) the moment a
// notifications row is added - never by the app.
//
// Deploy WITHOUT JWT verification, because the caller is the database, not a
// signed-in person:
//   npx supabase functions deploy send-push --no-verify-jwt --project-ref <ref>
// Secrets (npx supabase secrets set ... --project-ref <ref>):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   the web push key pair
//   VAPID_SUBJECT                         optional, a mailto: or https: contact (defaults to the site)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every function.
//
// Because it is reachable without a login, it trusts nothing in the request except
// an id: the notification itself is read from the database, and is "claimed"
// (pushed_at) before anything is sent, so nobody can make it send the same
// notification twice or send something that is not in the table.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  buildPushMessage,
  deliverPush,
  type ExpoMessage,
  type ExpoTicket,
  type PushNotificationRow,
  type PushSubscriptionRow,
} from '../_shared/push.ts';

const SITE = 'https://jageer-nepal.vercel.app';
// A notification this old is not worth a buzz any more (and the id is not a secret).
const MAX_AGE_MS = 10 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function sendToExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push service answered ${response.status}`);
  const { data } = await response.json();
  return data as ExpoTicket[];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: 'Send JSON like {"id": "<notification id>"}' }, 400);
  }
  if (typeof id !== 'string' || id.length < 10) return json({ error: 'id is required' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Claim it: only the first caller for a fresh notification gets to send.
  const { data: notification, error: claimError } = await admin
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pushed_at', null)
    .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .select('id, user_id, kind, request_id, title, body')
    .maybeSingle();
  if (claimError) return json({ error: claimError.message }, 500);
  if (!notification) return json({ ok: true, skipped: 'already sent, too old, or not found' });

  const { data: subscriptions, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, channel, endpoint, p256dh, auth')
    .eq('user_id', (notification as PushNotificationRow).user_id);
  if (subsError) return json({ error: subsError.message }, 500);
  if (!subscriptions || subscriptions.length === 0) return json({ ok: true, devices: 0 });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const webReady = !!publicKey && !!privateKey;
  if (webReady) webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? SITE, publicKey!, privateKey!);
  else console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set - browser pushes are skipped');

  const result = await deliverPush(
    subscriptions as PushSubscriptionRow[],
    buildPushMessage(notification as PushNotificationRow),
    {
      web: webReady
        ? async (sub, payload) => {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
              payload,
              { TTL: 60 * 60 * 24, urgency: 'high' }
            );
          }
        : undefined,
      expo: sendToExpo,
    }
  );

  // Forget devices that no longer exist, so they are not tried again.
  if (result.gone.length > 0) await admin.from('push_subscriptions').delete().in('id', result.gone);

  return json({ ok: true, devices: subscriptions.length, ...result, gone: result.gone.length });
});
