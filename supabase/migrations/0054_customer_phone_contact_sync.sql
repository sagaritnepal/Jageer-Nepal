-- Lets a saved customer be linked back to a specific entry in the owner's
-- phone contacts app, so the "Your Customers" list can be kept in sync with
-- whatever's saved on the phone (phone contact edits win for linked rows;
-- see lib/hooks/useContactsSync.ts). Manually-added customers (no phone
-- contact behind them) are untouched by sync and keep phone_contact_id null.

alter table customers add column if not exists phone_contact_id text;

-- One customer row per phone contact per owner - lets sync use this as an
-- upsert conflict target instead of matching by name/phone (which change).
create unique index if not exists customers_owner_phone_contact_idx
  on customers (owner_id, phone_contact_id)
  where phone_contact_id is not null;
