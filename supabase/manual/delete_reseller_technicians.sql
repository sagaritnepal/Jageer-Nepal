-- Permanently delete the technician accounts on one reseller's team (Sagar Rayamajhi's), their
-- logins included, so the same people can be registered again from scratch.
--
-- NOT a migration: do not put this in supabase/migrations. It is run by hand, once, in the Supabase
-- SQL Editor. There is no undo - if your plan has backups, take one first.
--
-- WHO is deleted: every technician with an accepted or pending employment under that reseller -
-- exactly the rows STEP 1b lists, nobody else. STEP 2 stops, changing nothing, unless that is
-- exactly v_expected people.
--
-- WHAT happens to each one is what delete_technician.sql does:
--   * live jobs (assigned / in progress) are cancelled first;
--   * job_cards.technician_id is KEPT and handed to the job's reseller (a job card's parts and labour
--     feed the job's amount and its bill); his name leaves them;
--   * finished jobs stay, but lose his name (service_requests.technician_id is emptied), so they drop
--     out of his work history - which is gone with him anyway;
--   * his other records that cannot exist without him (messages, reviews of him, employment records,
--     notifications ...) are deleted; cascade / set-null links are left to the database;
--   * then his profile, and then his login (auth.users), so the same email can sign up again.
-- All of it is one transaction: if anything cannot be done, nothing is changed.
--
-- NOT touched: photos he uploaded (chalans stay on their jobs), and the reseller's own account.
--
-- Run STEP 1 first. It only reads.

-- ============================================================================================
-- STEP 1 - look first (read-only).
-- ============================================================================================

-- 1a. The reseller. There must be exactly one row.
select id, full_name, role, phone
from profiles
where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi');

-- 1b. The technicians STEP 2 will delete. Check that every name and email is someone you mean to
-- remove, and that the count is the number you expect.
select p.id,
       p.full_name,
       p.phone,
       u.email,
       te.status as employment,
       (select count(*) from service_requests sr
         where sr.technician_id = p.id and sr.status in ('assigned', 'in_progress')) as live_jobs,
       (select count(*) from service_requests sr where sr.technician_id = p.id) as all_jobs
from technician_employment te
join profiles p on p.id = te.technician_id and p.role = 'technician'::user_role
left join auth.users u on u.id = p.id
where te.status in ('accepted', 'pending')
  and te.reseller_id = (
        select id from profiles
        where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'))
order by p.full_name;

-- ============================================================================================
-- STEP 2 - delete. Run only after STEP 1b shows exactly the people you want gone.
-- ============================================================================================
do $$
declare
  v_reseller_name text    := 'Sagar Rayamajhi';
  v_expected      int     := 4;     -- how many people STEP 1b listed
  v_delete_logins boolean := true;  -- false: leave the logins; delete them in dashboard > Authentication > Users

  v_reseller uuid;
  v_ids      uuid[];
  v_id       uuid;
  v_name     text;
  r          record;
  v_n        int;
begin
  -- strict: raises (and so changes nothing) when there is no match, or more than one.
  select id into strict v_reseller from profiles
   where role = 'reseller'::user_role and lower(trim(full_name)) = lower(v_reseller_name);

  select coalesce(array_agg(distinct te.technician_id), '{}') into v_ids
  from technician_employment te
  join profiles p on p.id = te.technician_id and p.role = 'technician'::user_role
  where te.reseller_id = v_reseller
    and te.status in ('accepted', 'pending');

  if cardinality(v_ids) <> v_expected then
    raise exception
      'Found % technician(s) on the team of %, but v_expected is %. Nothing was deleted. Run STEP 1b, then set v_expected to match.',
      cardinality(v_ids), v_reseller_name, v_expected;
  end if;

  foreach v_id in array v_ids loop
    select full_name into v_name from profiles where id = v_id;

    -- 0. A job that is under way cannot just lose its technician: cancel the live ones first.
    update service_requests
       set status = 'cancelled'
     where technician_id = v_id and status in ('assigned', 'in_progress');
    get diagnostics v_n = row_count;
    raise notice '%: cancelled % live job(s).', v_name, v_n;

    -- 1. Job cards stay (their parts and labour set the job's amount); the reseller takes his place.
    update job_cards jc
       set technician_id = sr.reseller_id
      from service_requests sr
     where jc.service_request_id = sr.id
       and jc.technician_id = v_id
       and sr.reseller_id is not null;
    get diagnostics v_n = row_count;
    raise notice '%: % job card(s) handed to the reseller.', v_name, v_n;

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
        raise notice '%: %.%: % row(s) %.', v_name, r.tbl, r.col, v_n, case when r.not_null then 'deleted' else 'cleared' end;
      end if;
    end loop;

    -- 3. The profile itself.
    delete from profiles where id = v_id;

    -- 4. His login, so the same email can register again.
    if v_delete_logins then
      delete from auth.users where id = v_id;
    end if;

    raise notice 'Deleted %.', v_name;
  end loop;

  raise notice 'Done: % technician(s) deleted from the team of %.', cardinality(v_ids), v_reseller_name;
end;
$$;
