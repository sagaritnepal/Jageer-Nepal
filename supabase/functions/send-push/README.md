# send-push

Delivers each new row in `notifications` as a push notification to every device the
recipient switched notifications on for - a browser (web push) or a phone (Expo push).

```
database                          Edge Function (this)                device
notifications INSERT  ──pg_net──▶  send-push {id}  ──web push / Expo──▶  banner
(migration 0084 trigger)           claims the row (pushed_at),
                                   reads the person's push_subscriptions
```

Nothing here can block the app: if the call fails, the notification is still saved and
still shows in the app's bell and list.

## One-time setup

1. **Database** - run `supabase/migrations/0084_push_notifications.sql` in the Supabase SQL Editor.
   It turns on the `pg_net` extension; if it says it could not, enable it under
   Database > Extensions.
2. **Deploy the function** (from the project folder). It is called by the database, not by a
   signed-in person, so JWT verification must be off:
   ```
   npx supabase login
   npx supabase functions deploy send-push --no-verify-jwt --project-ref ywapfmvcvqprfcdcopfp
   ```
3. **Secrets** - the web push key pair. The private half is in `supabase/.env.push-secrets`
   (git-ignored; never commit or share it):
   ```
   npx supabase secrets set --env-file supabase/.env.push-secrets --project-ref ywapfmvcvqprfcdcopfp
   ```
   The matching public key is in `lib/constants/push.ts`. If you ever change the key pair,
   change both, and everyone has to turn notifications on again.
4. **Turn it on per device** - open the app > Notifications > *Turn on notifications*.
   On an iPhone, first Share > *Add to Home Screen* and open the app from there.

## Phones (the Expo app)

The code is in place (`lib/hooks/usePushNotifications.native.ts`), but a phone build needs
credentials this repo cannot hold: Firebase Cloud Messaging (FCM V1) for Android and an
Apple Push key for iOS. `eas credentials` / the first `eas build` walk you through both.
Push does not work in Expo Go on Android - use a development or release build.

## Checking it works

Every delivery attempt is logged by the database:

```sql
select id, status_code, left(content::text, 120) as answer, created
from net._http_response order by created desc limit 10;
```

| status_code | meaning |
|---|---|
| 200 | the function ran (its answer says how many devices were reached) |
| 401 | the function was deployed *with* JWT verification - redeploy with `--no-verify-jwt` |
| 404 | the function is not deployed |
| empty table | `pg_net` is off, or `push_config` has no address |

The function's own log (Dashboard > Edge Functions > send-push > Logs) shows missing keys
and delivery problems. A device whose subscription the push service reports as gone
(404 / 410, or `DeviceNotRegistered` from Expo) is deleted automatically.
