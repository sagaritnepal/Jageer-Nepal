-- Resellers can now submit their own service requests (on behalf of a
-- customer who called them directly) the same way clients do. RLS policies
-- combine permissively, so this adds reseller access without touching the
-- existing client-only insert policy.

create policy service_requests_insert_reseller on service_requests
  for insert with check (client_id = auth.uid() and "current_role"() = 'reseller'::user_role);
