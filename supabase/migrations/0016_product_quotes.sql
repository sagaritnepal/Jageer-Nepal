-- Quotation portal: a client can ask a reseller for a custom price on a
-- specific listing; the reseller responds with a price (or declines); the
-- client accepts or declines that price. Mirrors the service_requests
-- pending -> quoted -> approved staged-status shape from
-- 0010_quote_approval_flow.sql, but as its own table + its own enum: orders
-- represent completed purchases, and a product quote is a distinct
-- pre-purchase negotiation with none of request_status's
-- technician-assignment states making sense here.
-- Additive only. Safe to run once against the existing schema.

create type quote_status as enum ('pending', 'quoted', 'accepted', 'declined');

create table if not exists product_quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  reseller_id uuid not null references profiles(id),
  product_id uuid not null references products(id),
  quantity integer not null default 1 check (quantity > 0),
  message text,
  quoted_price numeric,
  status quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_quotes_reseller_idx on product_quotes(reseller_id, status);
create index if not exists product_quotes_client_idx on product_quotes(client_id);

alter table product_quotes enable row level security;

create policy product_quotes_select on product_quotes
  for select using (
    client_id = auth.uid()
    or reseller_id = auth.uid()
    or is_admin()
  );

-- A client can only request a quote against a listing that is genuinely a
-- reseller's own row, and reseller_id must really be that row's seller.
create policy product_quotes_insert_client on product_quotes
  for insert with check (
    client_id = auth.uid()
    and "current_role"() = 'client'::user_role
    and exists (
      select 1 from products p
      where p.id = product_quotes.product_id
        and p.seller_id = product_quotes.reseller_id
        and p.seller_role = 'reseller'::user_role
    )
  );

create policy product_quotes_update_reseller on product_quotes
  for update using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());

create policy product_quotes_update_client on product_quotes
  for update using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy product_quotes_admin_all on product_quotes
  for all using (is_admin()) with check (is_admin());
