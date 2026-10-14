-- Permanently delete one technician: his profile and everything that points at him.
--
-- NOT a migration: do not put this in supabase/migrations. It is run by hand, once, in the Supabase
-- SQL Editor. There is no undo - if your plan has backups, take one first.
--
-- The database refuses to delete a profile while any row still points at it, and many tables do. So
-- STEP 2 looks up every foreign key that points at profiles and deals with each one:
--   * cascade / set-null links       the database clears these itself when the profile goes;
--   * job_cards.technician_id        KEPT, and handed to the job's reseller. A job card's parts and
--                                    labour feed the job's amount and its bill, so deleting them
--                                    would change finished jobs' totals. His name leaves them;
--   * any other optional link        his name is set to empty (service_requests.technician_id, a
--                                    team member's linked profile, ...);
--   * any other required link        those rows are deleted (his messages, reviews of him, his
--                                    employment records, ...).
-- Live jobs of his (assigned / in progress) are cancelled first. All of it happens in one
-- transaction: if anything cannot be done, nothing is changed.
--
-- NOT touched: the photos he uploaded (chalans stay on their jobs), and his login - delete that in
-- the Supabase dashboard, Authentication > Users, after STEP 2 has run.
--
-- Run STEP 1 first. It only reads.

-- ============================================================================================
-- STEP 1 - look first (read-only). Edit the name if yours is spelled differently.
-- ============================================================================================

-- 1a. Who matches. There must be exactly one row.
select id, full_name, role, phone
from profiles
where role = 'technician'::user_role and lower(trim(full_name)) = lower('Sushant Khanal');

-- 1b. His jobs, by status.
select sr.status, count(*) as jobs
from service_requests sr
where sr.technician_id = (
        select id from profiles
        where role = 'technician'::user_role and lower(trim(full_name)) = lower('Sushant Khanal'))
group by sr.status
order by sr.status;

-- 1c. Every table that points at him, how many rows, and what STEP 2 will do with them.
select *
from (
  select r.tbl,
         r.col,
         case
           when r.on_delete = 'c' then 'deleted automatically with his profile'
           when r.on_delete = 'n' then 'cleared automatically'
           when r.tbl = 'job_cards' and r.col = 'technician_id' then 'KEPT - handed to the job''s reseller'
           when not r.not_null then 'his name is taken off (set to empty)'
           else 'ROWS DELETED'
         end as what_happens,
         (xpath('/row/n/text()', query_to_xml(
            format('select count(*) as n from %s where %I = %L',
                   r.tbl, r.col,
                   (select id from profiles
                    where role = 'technician'::user_role
                      and lower(trim(full_name)) = lower('Sushant Khanal'))),
            false, true, '')))[1]::text::int as rows_pointing_at_him
  from (
    select c.conrelid::regclass::text as tbl,
           a.attname as col,
           a.attnotnull as not_null,
           c.confdeltype as on_delete
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and cardinality(c.conkey) = 1
  ) r
) t
where rows_pointing_at_him > 0
order by what_happens, tbl;

-- ============================================================================================
-- STEP 2 - delete. Run only after STEP 1 looks right.
-- ============================================================================================
do $$
declare
  v_name text := 'Sushant Khanal';
  v_id   uuid;
  r      record;
  v_n    int;
begin
  -- strict: raises (and so changes nothing) when there is no match, or more than one.
  select id into strict v_id from profiles
   where role = 'technician'::user_role and lower(trim(full_name)) = lower(v_name);

  -- 0. A job that is under way cannot just lose its technician: cancel the live ones first.
  update service_requests
     set status = 'cancelled'
   where technician_id = v_id and status in ('assigned', 'in_progress');
  get diagnostics v_n = row_count;
  raise notice 'Cancelled % live job(s).', v_n;

  -- 1. Job cards stay (their parts and labour set the job's amount); the reseller takes his place.
  update job_cards jc
     set technician_id = sr.reseller_id
    from service_requests sr
   where jc.service_request_id = sr.id
     and jc.technician_id = v_id
     and sr.reseller_id is not null;
  get diagnostics v_n = row_count;
  raise notice 'Job cards handed to the reseller: %.', v_n;

  -- 2. Everything else that points at him.
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
  raise notice 'Deleted the profile of %. Now delete his login: dashboard > Authentication > Users.', v_name;
end;
$$;
