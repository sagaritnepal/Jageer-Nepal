-- Core product loop: quoting, commission tracking, wholesale MOQ, reviews, messaging.
-- Additive only. Safe to run once against the existing schema.

-- 1. New columns -------------------------------------------------------

alter table service_requests add column if not exists quoted_price numeric;

alter table orders add column if not exists platform_fee numeric not null default 0;
alter table orders add column if not exists seller_payout numeric;

alter table products add column if not exists min_order_qty integer not null default 1;

-- 2. reviews -------------------------------------------------------------

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) unique,
  client_id uuid not null references profiles(id),
  technician_id uuid not null references profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists reviews_technician_idx on reviews(technician_id);

alter table reviews enable row level security;

create policy reviews_select_all on reviews
  for select using (true);

create policy reviews_insert_client on reviews
  for insert with check (
    client_id = auth.uid()
    and exists (
      select 1 from service_requests sr
      where sr.id = reviews.service_request_id
        and sr.client_id = auth.uid()
        and sr.status = 'resolved'
        and sr.technician_id = reviews.technician_id
    )
  );

create policy reviews_admin_all on reviews
  for all using (is_admin()) with check (is_admin());

-- 3. messages --------------------------------------------------------------

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('service_request', 'order')),
  subject_id uuid not null,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_subject_idx on messages(subject_type, subject_id, created_at);

alter table messages enable row level security;

create policy messages_select on messages
  for select using (
    sender_id = auth.uid()
    or is_admin()
    or (
      subject_type = 'service_request' and exists (
        select 1 from service_requests sr
        where sr.id = messages.subject_id
          and (sr.client_id = auth.uid() or sr.technician_id = auth.uid())
      )
    )
    or (
      subject_type = 'order' and exists (
        select 1 from orders o
        where o.id = messages.subject_id
          and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
    )
  );

create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (
        subject_type = 'service_request' and exists (
          select 1 from service_requests sr
          where sr.id = messages.subject_id
            and (sr.client_id = auth.uid() or sr.technician_id = auth.uid())
        )
      )
      or (
        subject_type = 'order' and exists (
          select 1 from orders o
          where o.id = messages.subject_id
            and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
        )
      )
    )
  );

create policy messages_admin_all on messages
  for all using (is_admin()) with check (is_admin());
