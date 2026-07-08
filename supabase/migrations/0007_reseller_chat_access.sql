-- Resellers/wholesalers had no access at all to service_request chat threads
-- (the RLS only checked client_id/technician_id). They need to message the
-- client both while triaging a pending request and after they've taken it on.

drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select using (
    sender_id = auth.uid()
    or is_admin()
    or (
      subject_type = 'service_request' and exists (
        select 1 from service_requests sr
        where sr.id = messages.subject_id
          and (
            sr.client_id = auth.uid()
            or sr.technician_id = auth.uid()
            or sr.reseller_id = auth.uid()
            or (sr.status = 'pending' and public."current_role"() = any (array['reseller', 'wholesaler']::user_role[]))
          )
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

drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (
        subject_type = 'service_request' and exists (
          select 1 from service_requests sr
          where sr.id = messages.subject_id
            and (
              sr.client_id = auth.uid()
              or sr.technician_id = auth.uid()
              or sr.reseller_id = auth.uid()
              or (sr.status = 'pending' and public."current_role"() = any (array['reseller', 'wholesaler']::user_role[]))
            )
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
