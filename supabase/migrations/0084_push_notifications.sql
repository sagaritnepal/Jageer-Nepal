-- Push delivery for notifications (builds on 0082 / 0083).
--
-- The notifications table already records everything somebody should hear
-- about; this adds the part that reaches a phone that has the app closed:
--
--   push_subscriptions  the devices a person has switched notifications on for
--                       (a browser's push endpoint, or a phone's Expo token)
--   register_push_subscription / unregister_push_subscription
--                       how the app adds and removes its own device
--   a trigger on notifications that, for every new row, asks the Edge Function
--                       `send-push` to deliver it (through pg_net, after the
--                       row is safely committed)
--
-- Delivery is best-effort and can never get in the way of the action that
-- caused the notification: if anything about it fails (pg_net is off, the
-- function is not deployed, the network is down) the notification is still
-- saved and still shows in the app.
--
-- Safe to run more than once.

-- 1. Devices ---------------------------------------------------------------------

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  channel text not null check (channel in ('web', 'expo')),
  -- web: the browser's push-service URL. expo: the ExponentPushToken[...].
  endpoint text not null unique,
  -- web only: the keys the browser gave for encrypting a message to it.
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on push_subscriptions;
create policy push_subscriptions_select_own on push_subscriptions
  for select using (user_id = auth.uid());

-- Devices are added and removed only through the two functions below.
revoke all on push_subscriptions from anon, authenticated;
grant select on push_subscriptions to authenticated;

-- Adds this device for the signed-in person. A device that was last used by
-- someone else (a shared phone) is handed over to the person now signed in, so
-- the previous person stops receiving pushes there.
create or replace function register_push_subscription(
  p_channel text,
  p_endpoint text,
  p_p256dh text default null,
  p_auth text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to turn on notifications';
  end if;
  if p_channel not in ('web', 'expo') then
    raise exception 'Unknown notification channel';
  end if;
  if p_endpoint is null or length(p_endpoint) < 10 then
    raise exception 'This device did not give a push address';
  end if;
  if p_channel = 'web' and (p_p256dh is null or p_auth is null) then
    raise exception 'The browser did not give its push keys';
  end if;

  insert into push_subscriptions (user_id, channel, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_channel, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        channel = excluded.channel,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        last_seen_at = now();

  -- Keep the ten most recently used devices; anything older is long forgotten.
  delete from push_subscriptions
  where id in (
    select id from push_subscriptions
    where user_id = auth.uid()
    order by last_seen_at desc
    offset 10
  );
end;
$$;

create or replace function unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function register_push_subscription(text, text, text, text, text) from public, anon;
revoke all on function unregister_push_subscription(text) from public, anon;
grant execute on function register_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function unregister_push_subscription(text) to authenticated;

-- 2. Delivery --------------------------------------------------------------------

-- Set once the Edge Function has picked a notification up, so it is never sent
-- twice (the function claims it before sending).
alter table notifications add column if not exists pushed_at timestamptz;

-- Where the Edge Function lives. Not readable from the app.
create table if not exists push_config (
  id boolean primary key default true check (id),
  function_url text not null
);

alter table push_config enable row level security;
revoke all on push_config from anon, authenticated;

insert into push_config (function_url)
values ('https://ywapfmvcvqprfcdcopfp.supabase.co/functions/v1/send-push')
on conflict (id) do nothing;

-- pg_net lets the database make the HTTP call. On Supabase it is a one-click
-- extension; if this cannot enable it, turn it on under Database > Extensions.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net could not be enabled (%). Enable it under Database > Extensions and pushes will start flowing.', sqlerrm;
end $$;

create or replace function push_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  begin
    select function_url into v_url from push_config limit 1;
    if v_url is not null then
      perform net.http_post(url := v_url, body := jsonb_build_object('id', new.id));
    end if;
  exception when others then
    -- Best-effort: never break the action that made the notification.
    null;
  end;
  return new;
end;
$$;

revoke all on function push_new_notification() from public;

drop trigger if exists notifications_push on notifications;
create trigger notifications_push
  after insert on notifications
  for each row execute function push_new_notification();
