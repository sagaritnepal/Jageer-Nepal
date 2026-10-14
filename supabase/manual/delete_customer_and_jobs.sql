-- Permanently delete one CUSTOMER's jobs (and optionally the customer) from one reseller's work.
--
-- NOT a migration: do not put this in supabase/migrations. It is run by hand, once, in the Supabase
-- SQL Editor. There is no undo - if your plan has backups, take one first.
--
-- This is for jobs where the person is the CUSTOMER on the job (the name and phone typed on it). It
-- is different from remove_technician_from_work.sql / delete_technician.sql, which are about a
-- person as the TECHNICIAN doing the work.
--
-- What STEP 2 does, in one transaction (if anything cannot be done, nothing is changed):
--   1. Finds the reseller's jobs whose customer name or phone matches.
--   2. Stops, changing nothing, if there is money attached - payments, bills, or manual ledger
--      entries - unless you switch v_delete_money on. That money is what the cash, bank and Day
--      Book figures are made of, so deleting it changes them.
--   3. Deletes the jobs' own ledger entries, job cards, messages and reviews, and any other row that
--      points at those jobs, and then the jobs.
--   4. Deletes the customer's record (their ledger goes with it) when v_delete_customer is on and
--      nothing else still points at it.
--
-- Run STEP 1 first. It only reads.

-- ============================================================================================
-- STEP 1 - look first (read-only). Edit the names / phone in these queries if they differ.
-- ============================================================================================

-- 1a. The reseller. Exactly one row.
select id, full_name, role from profiles
where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi');

-- 1b. The jobs that will be deleted, with what is attached to each.
select sr.ticket_no,
       sr.issue_type,
       sr.status,
       sr.payment_status,
       sr.customer_name,
       sr.customer_phone,
       sr.quoted_price,
       (select count(*) from customer_ledger_entries e
         where e.source_id = sr.id and e.source_type like 'service_request%') as ledger_rows,
       (select count(*) from business_transactions b
         where b.source_type like 'service_request%'
           and (b.source_id = sr.id or sr.id = any (b.source_job_ids))) as bills_or_payments
from service_requests sr
where sr.reseller_id = (select id from profiles
                        where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'))
  and (lower(trim(sr.customer_name)) = lower('Sushant Khanal') or sr.customer_phone = '9761806682')
order by sr.ticket_no;

-- 1c. The customer record(s), and everything on their ledger and in their bills.
select c.id, c.name, c.phone,
       (select count(*) from customer_ledger_entries e where e.customer_id = c.id) as ledger_entries,
       (select count(*) from business_transactions b where b.customer_id = c.id) as bills
from customers c
where c.owner_id = (select id from profiles
                    where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'))
  and (lower(trim(c.name)) = lower('Sushant Khanal') or c.phone = '9761806682');

-- If 1b shows bills_or_payments above 0 anywhere, or 1c shows bills / ledger entries beyond the
-- jobs' own, there is MONEY attached: STEP 2 will stop until you set v_delete_money to true.

-- ============================================================================================
-- STEP 2 - delete. Run only after STEP 1 looks right.
-- ============================================================================================
do $$
declare
  v_customer_name  text    := 'Sushant Khanal';
  v_customer_phone text    := '9761806682';
  v_reseller_name  text    := 'Sagar Rayamajhi';
  -- Off by default: payments, bills and manual ledger entries feed the cash / bank / Day Book
  -- figures, so deleting them changes those. Turn on after STEP 1 shows what they are.
  v_delete_money   boolean := false;
  v_delete_customer boolean := true;

  v_reseller  uuid;
  v_jobs      uuid[];
  v_customers uuid[];
  v_money     int;
  v_n         int;
  r           record;
begin
  select id into strict v_reseller from profiles
   where role = 'reseller'::user_role and lower(trim(full_name)) = lower(v_reseller_name);

  select coalesce(array_agg(id), '{}') into v_jobs
    from service_requests
   where reseller_id = v_reseller
     and (lower(trim(customer_name)) = lower(v_customer_name) or customer_phone = v_customer_phone);

  select coalesce(array_agg(distinct x), '{}') into v_customers
    from (
      select customer_id as x from service_requests where id = any (v_jobs) and customer_id is not null
      union
      select id from customers
       where owner_id = v_reseller
         and (lower(trim(name)) = lower(v_customer_name) or phone = v_customer_phone)
    ) s;

  if cardinality(v_jobs) = 0 and cardinality(v_customers) = 0 then
    raise exception 'Nothing found for % under %.', v_customer_name, v_reseller_name;
  end if;
  raise notice 'Found % job(s) and % customer record(s).', cardinality(v_jobs), cardinality(v_customers);

  -- Money attached: bills, job payments, and ledger entries that are not the jobs' own posting.
  select
      (select count(*) from business_transactions b
        where b.owner_id = v_reseller
          and (b.customer_id = any (v_customers)
               or (b.source_type like 'service_request%' and b.source_id = any (v_jobs))
               or b.source_job_ids && v_jobs))
    + (select count(*) from customer_ledger_entries e
        where e.customer_id = any (v_customers)
          and e.source_type is distinct from 'service_request'
          and e.source_type is distinct from 'business_transaction')
    into v_money;

  if v_money > 0 and not v_delete_money then
    raise exception
      '% payment(s), bill(s) or manual ledger entr(ies) are attached. They feed your cash / bank / Day Book figures. Nothing was changed. Set v_delete_money to true to delete them as well.',
      v_money;
  end if;

  -- 1. Bills and job payments (their ledger entries go with them, as in the app).
  delete from business_transactions b
   where b.owner_id = v_reseller
     and (b.customer_id = any (v_customers)
          or (b.source_type like 'service_request%' and b.source_id = any (v_jobs))
          or b.source_job_ids && v_jobs);
  get diagnostics v_n = row_count;
  raise notice 'Bills / payments deleted: %.', v_n;

  -- 2. The jobs' own ledger entries (the price posted when each was completed, and any payment).
  delete from customer_ledger_entries
   where source_id = any (v_jobs) and source_type like 'service_request%';
  get diagnostics v_n = row_count;
  raise notice 'Job ledger entries deleted: %.', v_n;

  -- 3. Chat on the jobs, then every table that points at a job (job cards, reviews, ...).
  delete from messages where subject_type = 'service_request' and subject_id = any (v_jobs);

  for r in
    select c.conrelid::regclass::text as tbl,
           a.attname as col,
           a.attnotnull as not_null,
           c.confdeltype as on_delete
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.service_requests'::regclass
      and cardinality(c.conkey) = 1
    order by 1, 2
  loop
    continue when r.tbl = 'service_requests';        -- never touch other jobs through a self link
    continue when r.on_delete in ('c', 'n');          -- the database clears these itself

    if r.not_null then
      execute format('delete from %s where %I = any ($1)', r.tbl, r.col) using v_jobs;
    else
      execute format('update %s set %I = null where %I = any ($1)', r.tbl, r.col, r.col) using v_jobs;
    end if;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      raise notice '%.%: % row(s) %.', r.tbl, r.col, v_n, case when r.not_null then 'deleted' else 'cleared' end;
    end if;
  end loop;

  -- 4. The jobs.
  delete from service_requests where id = any (v_jobs);
  get diagnostics v_n = row_count;
  raise notice 'Jobs deleted: %.', v_n;

  -- 5. The customer record. Its ledger goes with it (on delete cascade); if something else still
  --    points at it, it is kept and the rest stays done.
  if v_delete_customer and cardinality(v_customers) > 0 then
    begin
      delete from customers where id = any (v_customers);
      get diagnostics v_n = row_count;
      raise notice 'Customer record(s) deleted: %.', v_n;
    exception when foreign_key_violation then
      raise notice 'Customer record kept: something else still points at it (%).', sqlerrm;
    end;
  end if;
end;
$$;
