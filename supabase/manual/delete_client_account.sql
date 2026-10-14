-- Permanently delete one CLIENT (customer-app) account: its profile and the small personal records
-- that point at it.
--
-- NOT a migration: do not put this in supabase/migrations. It is run by hand, once, in the Supabase
-- SQL Editor. There is no undo - if your plan has backups, take one first.
--
-- Safe by design, in one transaction (if anything cannot be done, nothing is changed):
--   * it only acts on the one profile below - this id, role client, and this name;
--   * it STOPS, changing nothing, if the account has any job, order, bill, customer record or other
--     work/money attached (it counts them first);
--   * links the database clears by itself (cascade / set null) are left to it; any other optional
--     link has its value set to empty, and any other required link has those rows deleted (the
--     account's own messages, saved contacts, reviews it wrote ...).
--
-- NOT touched: its login. Delete that in the Supabase dashboard, Authentication > Users, after this
-- has run. Until then the login exists with no profile behind it.
--
-- Run the whole thing at once. No separate preview is needed: the checks above are built in.

do $$
declare
  v_id   uuid := '147d5313-bd38-4a91-8a53-85d73f3cbe4f';
  v_name text := 'Sushant Khanal';
  v_used int;
  v_n    int;
  r      record;
begin
  -- 0. It must be exactly that profile.
  perform 1 from profiles
   where id = v_id and role = 'client'::user_role and lower(trim(full_name)) = lower(v_name);
  if not found then
    raise exception 'No client profile % named % was found - nothing was deleted.', v_id, v_name;
  end if;

  -- 1. Refuse if real work or money is attached to it.
  select (select count(*) from service_requests
           where client_id = v_id or reseller_id = v_id or technician_id = v_id)
       + (select count(*) from orders where buyer_id = v_id or seller_id = v_id)
       + (select count(*) from business_transactions where owner_id = v_id)
       + (select count(*) from customers where owner_id = v_id)
    into v_used;
  if v_used > 0 then
    raise exception
      'This account has % job(s), order(s), bill(s) or customer record(s) attached. Nothing was changed.',
      v_used;
  end if;

  -- 2. Everything else that points at the profile.
  for r in
    select c.conrelid::regclass::text as tbl,
           a.attname as col,
           a.attnotnull as not_null,
           c.confdeltype as on_delete
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and cardinality(c.conkey) = 1
    order by 1, 2
  loop
    -- cascade ('c') and set-null ('n') links are done by the database when the profile is deleted.
    continue when r.on_delete in ('c', 'n');

    if r.not_null then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_id;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_id;
    end if;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      raise notice '%.%: % row(s) %.', r.tbl, r.col, v_n, case when r.not_null then 'deleted' else 'cleared' end;
    end if;
  end loop;

  -- 3. The profile itself.
  delete from profiles where id = v_id;
  raise notice 'Deleted the client profile of %. Now delete its login: dashboard > Authentication > Users.', v_name;
end;
$$;
