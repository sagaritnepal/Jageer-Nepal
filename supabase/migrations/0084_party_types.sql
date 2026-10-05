-- Lets a reseller say what kind of party each person in their Ledger is:
-- Customer, Vendor, Employee, or any type they add themselves. The list of
-- types belongs to each reseller (rename, add, delete as they like), so it is
-- a table of its own rather than a fixed enum; the app fills in the three
-- starter types the first time a reseller opens it.
--
-- A party's type is only a label - it does not move anything between the
-- customer and vendor ledgers. Deleting a type leaves its parties untyped.
-- Additive only. Safe to run once against the existing schema.

create table if not exists party_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  created_at timestamptz not null default now()
);

-- Plain (owner_id, name) so the app can upsert the starter types by column
-- name (PostgREST's on_conflict cannot reference an expression index), same
-- reason as finance_items_owner_name_idx in 0063.
create unique index if not exists party_types_owner_name_idx
  on party_types (owner_id, name);

alter table party_types enable row level security;

create policy party_types_all_owner on party_types
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy party_types_admin_all on party_types
  for all using (is_admin()) with check (is_admin());

alter table customers
  add column if not exists party_type_id uuid references party_types(id) on delete set null;

create index if not exists customers_party_type_idx on customers (party_type_id);
