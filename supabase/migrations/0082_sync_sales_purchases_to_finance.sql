-- =====================================================================
-- Copy every sale and purchase into the separate Finance app
--
-- Finance is its own app with its own Supabase project. A person who has an
-- account in both with the SAME email (confirmed in both) gets their Jageer
-- sales and purchases copied into their Finance books automatically:
-- created, edited, deleted, and re-typed away from sale/purchase all follow.
--
-- One-way (Jageer -> Finance). Expenses and payments are not sent.
--
-- It cannot slow down or break billing: the call is queued (pg_net) after
-- the bill is saved, and any error inside the trigger is swallowed with a
-- warning. If sync is not configured (no secrets below) it does nothing.
--
-- ---------------------------------------------------------------------
-- ONE-TIME SETUP (SQL editor, as postgres). Run Finance's migration 0003
-- first, then in FINANCE run:   select public.finance_set_sync_secret();
-- and copy the secret it prints. Then, in JAGEER, run these three with your
-- real values (they go into Supabase Vault, not into this file):
--
--   select vault.create_secret('https://<finance-project-ref>.supabase.co', 'finance_sync_url');
--   select vault.create_secret('<finance anon / publishable key>',          'finance_sync_key');
--   select vault.create_secret('<the secret from finance_set_sync_secret>', 'finance_sync_secret');
--
-- To replace one later: select vault.update_secret(id, 'new value') for the
-- row in vault.secrets with that name.
--
-- Copy the bills Jageer already has for one person:
--   select public.finance_resync_bills('someone@example.com');
-- It is safe to run again; bills are keyed by their Jageer id.
-- ---------------------------------------------------------------------
-- Additive only. Safe to run once against the existing schema.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- A named value from Vault, or null when it has not been set.
create or replace function public.finance_sync_setting(p_name text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = p_name limit 1;
$$;
revoke all on function public.finance_sync_setting(text) from public, anon, authenticated;

-- Queues one bill for Finance. p_op is 'upsert' or 'delete'.
create or replace function public.finance_send_bill(p_op text, p_row public.business_transactions, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url     text := public.finance_sync_setting('finance_sync_url');
  v_key     text := public.finance_sync_setting('finance_sync_key');
  v_secret  text := public.finance_sync_setting('finance_sync_secret');
  v_email   text;
  v_party   jsonb;
  v_bank    text;
  v_headers jsonb;
begin
  -- Not set up: nothing to do.
  if v_url is null or v_key is null or v_secret is null then
    return;
  end if;

  -- Only people whose email is confirmed here; Finance checks its side.
  select lower(u.email) into v_email
    from auth.users u
   where u.id = p_owner and u.email_confirmed_at is not null;
  if v_email is null then
    return;
  end if;

  if p_row.customer_id is not null then
    select jsonb_build_object(
             'id', c.id, 'name', c.name, 'phone', c.phone, 'address', c.address,
             'latitude', c.latitude, 'longitude', c.longitude,
             'contact_person_name', c.contact_person_name,
             'contact_person_phone', c.contact_person_phone)
      into v_party
      from customers c
     where c.id = p_row.customer_id;
  end if;

  if p_row.bank_account_id is not null then
    select b.name into v_bank from bank_accounts b where b.id = p_row.bank_account_id;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key);
  -- Legacy anon keys are JWTs and go in Authorization too; the newer
  -- sb_publishable_ keys are sent in apikey only.
  if v_key like 'eyJ%' then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_key);
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/rest/v1/rpc/finance_apply_jageer_bill',
    headers := v_headers,
    body    := jsonb_build_object(
                 'p_secret',    v_secret,
                 'p_op',        p_op,
                 'p_email',     v_email,
                 'p_bill',      to_jsonb(p_row),
                 'p_party',     v_party,
                 'p_bank_name', v_bank)
  );
end;
$$;
revoke all on function public.finance_send_bill(text, public.business_transactions, uuid) from public, anon, authenticated;

create or replace function public.business_transactions_push_to_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_op = 'DELETE' then
      if old.type in ('sale', 'purchase') then
        perform public.finance_send_bill('delete', old, old.owner_id);
      end if;
    else
      -- Moved to someone else's books: take it out of the old owner's.
      if tg_op = 'UPDATE' and old.owner_id is distinct from new.owner_id and old.type in ('sale', 'purchase') then
        perform public.finance_send_bill('delete', old, old.owner_id);
      end if;

      if new.type in ('sale', 'purchase') then
        perform public.finance_send_bill('upsert', new, new.owner_id);
      elsif tg_op = 'UPDATE' and old.type in ('sale', 'purchase') then
        -- Re-typed (say, to an expense): it is no longer a sale or purchase.
        perform public.finance_send_bill('delete', new, new.owner_id);
      end if;
    end if;
  exception when others then
    -- Finance being down or misconfigured must never block a bill here.
    raise warning 'finance sync skipped: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

drop trigger if exists business_transactions_push_to_finance on public.business_transactions;
create trigger business_transactions_push_to_finance
  after insert or update or delete on public.business_transactions
  for each row execute function public.business_transactions_push_to_finance();

-- Sends every sale and purchase one person already has (a first copy, or a
-- repair after Finance was unreachable). Returns how many were queued.
create or replace function public.finance_resync_bills(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  r       public.business_transactions;
  n       integer := 0;
begin
  select u.id into v_owner
    from auth.users u
   where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null;

  if v_owner is null then
    raise exception 'no confirmed Jageer account for %', p_email;
  end if;

  for r in
    select * from public.business_transactions
     where owner_id = v_owner and type in ('sale', 'purchase')
     order by created_at
  loop
    perform public.finance_send_bill('upsert', r, v_owner);
    n := n + 1;
  end loop;

  return n;
end;
$$;
revoke all on function public.finance_resync_bills(text) from public, anon, authenticated;
