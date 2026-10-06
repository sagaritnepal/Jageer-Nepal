-- =====================================================================
-- Copy ALL of a person's finance data into the separate Finance app
--
-- Extends 0082 (run that first, and set up its Vault secrets). Where 0082
-- sent only sales and purchases, this sends everything on the Finance page:
--
--   business_transactions    sales, purchases AND expenses
--   customers                customers and vendors
--   bank_accounts
--   customer_ledger_entries  payments in, and debits that are not from a bill
--   vendor_ledger_entries    payments out, and debits that are not from a bill
--   account_transfers
--
-- Ledger rows Jageer derives from a bill (source_type = 'business_transaction')
-- are not sent; Finance books the same debt itself from the synced bill, and
-- sending both would count it twice.
--
-- Same rules as 0082: matched by the SAME EMAIL (confirmed in both apps),
-- one-way, queued after the row is saved, and any failure is swallowed with a
-- warning so it can never block anything in Jageer.
--
-- Copy what a person already has (also a repair after Finance was
-- unreachable; safe to repeat):
--   select public.finance_resync_all('someone@example.com');
-- Additive only. Safe to run once against the existing schema.
-- =====================================================================

-- Rows that are derived from a bill and so must not be sent on their own.
create or replace function public.finance_skip_row(p_kind text, p_row jsonb)
returns boolean
language sql
immutable
as $$
  select p_kind in ('customer_entry', 'vendor_entry')
     and coalesce(p_row ->> 'source_type', '') = 'business_transaction';
$$;

-- Sends one row, with everything it points at (party, bank accounts, expense
-- category) so Finance never needs another call to understand it.
create or replace function public.finance_post_json(p_kind text, p_op text, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url       text := public.finance_sync_setting('finance_sync_url');
  v_key       text := public.finance_sync_setting('finance_sync_key');
  v_secret    text := public.finance_sync_setting('finance_sync_secret');
  v_owner     uuid := nullif(p_row ->> 'owner_id', '')::uuid;
  v_email     text;
  v_party_id  uuid;
  v_bank_id   uuid;
  v_bank2_id  uuid;
  v_cat_id    uuid;
  v_party     jsonb;
  v_bank      jsonb;
  v_bank2     jsonb;
  v_category  text;
  v_headers   jsonb;
begin
  if v_url is null or v_key is null or v_secret is null or v_owner is null then
    return; -- not set up, or nothing to attribute it to
  end if;

  select lower(u.email) into v_email
    from auth.users u
   where u.id = v_owner and u.email_confirmed_at is not null;
  if v_email is null then
    return; -- only people with a confirmed email here; Finance checks its side
  end if;

  if p_kind = 'bill' then
    v_party_id := nullif(p_row ->> 'customer_id', '')::uuid;
    v_bank_id  := nullif(p_row ->> 'bank_account_id', '')::uuid;
    v_cat_id   := nullif(p_row ->> 'expense_category_id', '')::uuid;
  elsif p_kind = 'customer_entry' then
    v_party_id := nullif(p_row ->> 'customer_id', '')::uuid;
    v_bank_id  := nullif(p_row ->> 'bank_account_id', '')::uuid;
  elsif p_kind = 'vendor_entry' then
    v_party_id := nullif(p_row ->> 'vendor_id', '')::uuid;
    v_bank_id  := nullif(p_row ->> 'bank_account_id', '')::uuid;
  elsif p_kind = 'transfer' then
    v_bank_id  := nullif(p_row ->> 'from_account_id', '')::uuid;
    v_bank2_id := nullif(p_row ->> 'to_account_id', '')::uuid;
  end if;

  if v_party_id is not null then
    select jsonb_build_object(
             'id', c.id, 'name', c.name, 'phone', c.phone, 'address', c.address,
             'latitude', c.latitude, 'longitude', c.longitude,
             'contact_person_name', c.contact_person_name,
             'contact_person_phone', c.contact_person_phone)
      into v_party from customers c where c.id = v_party_id;
  end if;
  if v_bank_id is not null then
    select jsonb_build_object('id', b.id, 'name', b.name) into v_bank from bank_accounts b where b.id = v_bank_id;
  end if;
  if v_bank2_id is not null then
    select jsonb_build_object('id', b.id, 'name', b.name) into v_bank2 from bank_accounts b where b.id = v_bank2_id;
  end if;
  if v_cat_id is not null then
    select c.name into v_category from expense_categories c where c.id = v_cat_id;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key);
  -- Legacy anon keys are JWTs and go in Authorization too; the newer
  -- sb_publishable_ keys are sent in apikey only.
  if v_key like 'eyJ%' then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_key);
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/rest/v1/rpc/finance_apply_jageer_record',
    headers := v_headers,
    body    := jsonb_build_object(
                 'p_secret',   v_secret,
                 'p_op',       p_op,
                 'p_email',    v_email,
                 'p_kind',     p_kind,
                 'p_row',      p_row,
                 'p_party',    v_party,
                 'p_bank',     v_bank,
                 'p_bank2',    v_bank2,
                 'p_category', v_category)
  );
end;
$$;
revoke all on function public.finance_post_json(text, text, jsonb) from public, anon, authenticated;

-- One trigger function for every table; the kind comes from the trigger's
-- argument.
create or replace function public.finance_push_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := tg_argv[0];
  v_old  jsonb;
  v_new  jsonb;
begin
  begin
    if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

    -- Gone from the old owner's books: deleted, or handed to someone else.
    if tg_op <> 'INSERT' and not public.finance_skip_row(v_kind, v_old) then
      if tg_op = 'DELETE' or (v_old ->> 'owner_id') is distinct from (v_new ->> 'owner_id') then
        perform public.finance_post_json(v_kind, 'delete', v_old);
      end if;
    end if;

    if tg_op <> 'DELETE' and not public.finance_skip_row(v_kind, v_new) then
      perform public.finance_post_json(v_kind, 'upsert', v_new);
    end if;
  exception when others then
    -- Finance being down or misconfigured must never block anything here.
    raise warning 'finance sync skipped: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

-- 0082's sales-and-purchases-only trigger is replaced by the general one.
drop trigger if exists business_transactions_push_to_finance on public.business_transactions;

drop trigger if exists finance_sync_bill on public.business_transactions;
create trigger finance_sync_bill
  after insert or update or delete on public.business_transactions
  for each row execute function public.finance_push_row('bill');

drop trigger if exists finance_sync_customer on public.customers;
create trigger finance_sync_customer
  after insert or update or delete on public.customers
  for each row execute function public.finance_push_row('customer');

drop trigger if exists finance_sync_bank_account on public.bank_accounts;
create trigger finance_sync_bank_account
  after insert or update or delete on public.bank_accounts
  for each row execute function public.finance_push_row('bank_account');

drop trigger if exists finance_sync_customer_entry on public.customer_ledger_entries;
create trigger finance_sync_customer_entry
  after insert or update or delete on public.customer_ledger_entries
  for each row execute function public.finance_push_row('customer_entry');

drop trigger if exists finance_sync_vendor_entry on public.vendor_ledger_entries;
create trigger finance_sync_vendor_entry
  after insert or update or delete on public.vendor_ledger_entries
  for each row execute function public.finance_push_row('vendor_entry');

drop trigger if exists finance_sync_transfer on public.account_transfers;
create trigger finance_sync_transfer
  after insert or update or delete on public.account_transfers
  for each row execute function public.finance_push_row('transfer');

-- Sends everything one person has, in an order that reads naturally (banks
-- and parties first). Returns how many of each were queued.
create or replace function public.finance_resync_all(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  r       record;
  n       integer;
  v_out   jsonb := '{}'::jsonb;
begin
  select u.id into v_owner
    from auth.users u
   where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null;
  if v_owner is null then
    raise exception 'no confirmed Jageer account for %', p_email;
  end if;

  n := 0;
  for r in select to_jsonb(t) as j from public.bank_accounts t where t.owner_id = v_owner order by t.created_at loop
    perform public.finance_post_json('bank_account', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('bank_accounts', n);

  n := 0;
  for r in select to_jsonb(t) as j from public.customers t where t.owner_id = v_owner order by t.created_at loop
    perform public.finance_post_json('customer', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('customers', n);

  n := 0;
  for r in select to_jsonb(t) as j from public.business_transactions t where t.owner_id = v_owner order by t.created_at loop
    perform public.finance_post_json('bill', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('bills', n);

  n := 0;
  for r in select to_jsonb(t) as j from public.customer_ledger_entries t
            where t.owner_id = v_owner and coalesce(t.source_type, '') <> 'business_transaction' order by t.created_at loop
    perform public.finance_post_json('customer_entry', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('customer_entries', n);

  n := 0;
  for r in select to_jsonb(t) as j from public.vendor_ledger_entries t
            where t.owner_id = v_owner and coalesce(t.source_type, '') <> 'business_transaction' order by t.created_at loop
    perform public.finance_post_json('vendor_entry', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('vendor_entries', n);

  n := 0;
  for r in select to_jsonb(t) as j from public.account_transfers t where t.owner_id = v_owner order by t.created_at loop
    perform public.finance_post_json('transfer', 'upsert', r.j); n := n + 1;
  end loop;
  v_out := v_out || jsonb_build_object('transfers', n);

  return v_out;
end;
$$;
revoke all on function public.finance_resync_all(text) from public, anon, authenticated;
