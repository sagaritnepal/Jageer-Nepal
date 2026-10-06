-- Lets a person be deleted from the Ledger.
--
-- The database refuses to delete a customer while another table still points at
-- them without an "on delete" rule. A job's customer link (service_requests
-- .customer_id, 0033) was made that way, so anyone who had ever had a job could
-- not be removed - the delete was refused and the person stayed. The vendor
-- ledger's link to the same directory (created outside these migrations) can be
-- the same. This gives each such link a rule:
--   * a job keeps existing, just no longer linked to the deleted person
--     (the column can be empty, so: set null)
--   * a vendor ledger entry belongs to its person and goes with them, the same
--     as customer ledger entries already do (the column is required, so: cascade)
--
-- Safe to run more than once: it only touches links that still have no rule.
-- Run it once in the Supabase SQL Editor.

do $$
declare
  r record;
begin
  for r in
    select c.conname,
           c.conrelid::regclass as tbl,
           a.attname            as col,
           a.attnotnull         as required
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.customers'::regclass
       and array_length(c.conkey, 1) = 1
       and c.confdeltype in ('a', 'r')   -- "no action" / "restrict": the ones that block a delete
       and c.conrelid::regclass::text in ('service_requests', 'vendor_ledger_entries',
                                          'public.service_requests', 'public.vendor_ledger_entries')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.customers(id) on delete %s',
      r.tbl, r.conname, r.col,
      case when r.required then 'cascade' else 'set null' end
    );
    raise notice 'customer link fixed: %.% (on delete %)',
      r.tbl, r.col, case when r.required then 'cascade' else 'set null' end;
  end loop;
end
$$;
