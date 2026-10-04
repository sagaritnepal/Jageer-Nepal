// Shared by the send-push Edge Function. Deliberately has no imports and no Deno
// calls: the senders (the real web-push library, the Expo push API) are handed
// in, so the same code runs - and is tested - without a network.

export interface PushNotificationRow {
  id: string;
  user_id: string;
  kind: string;
  request_id: string | null;
  title: string;
  body: string | null;
}

export interface PushSubscriptionRow {
  id: string;
  channel: 'web' | 'expo';
  /** web: the browser's push-service URL. expo: the ExponentPushToken. */
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

/** What a push carries: enough for the device to show it and to know where to go. */
export interface PushMessage {
  title: string;
  body: string;
  /** Same tag = replaces the earlier banner; one per notification so none are swallowed. */
  tag: string;
  /** Where tapping it opens on the web. The notifications page is the one place
   * every role has at a fixed address (the web app cannot deep-link to a job). */
  url: string;
  data: { id: string; kind: string; request_id: string | null; url: string };
}

export function buildPushMessage(notification: PushNotificationRow): PushMessage {
  const url = '/notifications';
  return {
    title: notification.title,
    body: notification.body ?? '',
    tag: `notification-${notification.id}`,
    url,
    data: { id: notification.id, kind: notification.kind, request_id: notification.request_id, url },
  };
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: PushMessage['data'];
  sound: 'default';
  channelId: 'default';
  priority: 'high';
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Sends one encrypted web push. Must throw an error with a `statusCode` when the push service refuses it. */
export type WebSender = (subscription: PushSubscriptionRow, payload: string) => Promise<void>;
/** Sends up to 100 Expo messages and returns one ticket per message, in order. */
export type ExpoSender = (messages: ExpoMessage[]) => Promise<ExpoTicket[]>;

export interface DeliveryResult {
  sent: number;
  failed: number;
  /** Subscriptions the push service says no longer exist: delete them. */
  gone: string[];
}

const EXPO_BATCH = 100;

/** A browser or phone push service answers 404 / 410 for a subscription that was
 * cancelled or expired - it will never work again. Anything else (a timeout, a
 * 5xx) may be temporary, so those are kept. */
function isGone(error: unknown): boolean {
  const code = (error as { statusCode?: number } | null)?.statusCode;
  return code === 404 || code === 410;
}

export async function deliverPush(
  subscriptions: PushSubscriptionRow[],
  message: PushMessage,
  senders: { web?: WebSender; expo?: ExpoSender }
): Promise<DeliveryResult> {
  const result: DeliveryResult = { sent: 0, failed: 0, gone: [] };

  // Browsers: one encrypted request each.
  const webPayload = JSON.stringify({
    title: message.title,
    body: message.body,
    tag: message.tag,
    url: message.url,
    id: message.data.id,
    kind: message.data.kind,
  });
  const web = subscriptions.filter((s) => s.channel === 'web');
  await Promise.all(
    web.map(async (subscription) => {
      if (!senders.web) {
        result.failed += 1;
        return;
      }
      try {
        await senders.web(subscription, webPayload);
        result.sent += 1;
      } catch (error) {
        if (isGone(error)) result.gone.push(subscription.id);
        else result.failed += 1;
      }
    })
  );

  // Phones: batched through Expo's push service.
  const phones = subscriptions.filter((s) => s.channel === 'expo');
  for (let start = 0; start < phones.length; start += EXPO_BATCH) {
    const batch = phones.slice(start, start + EXPO_BATCH);
    if (!senders.expo) {
      result.failed += batch.length;
      continue;
    }
    const messages: ExpoMessage[] = batch.map((s) => ({
      to: s.endpoint,
      title: message.title,
      body: message.body,
      data: message.data,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
    }));
    try {
      const tickets = await senders.expo(messages);
      batch.forEach((subscription, i) => {
        const ticket = tickets[i];
        if (ticket?.status === 'ok') result.sent += 1;
        else if (ticket?.details?.error === 'DeviceNotRegistered') result.gone.push(subscription.id);
        else result.failed += 1;
      });
    } catch {
      result.failed += batch.length;
    }
  }

  return result;
}
