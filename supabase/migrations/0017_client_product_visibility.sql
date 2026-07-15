-- Clients must never see a wholesaler's cost-basis listing (what resellers
-- pay), only reseller-owned retail listings. Today's products SELECT policy
-- (products_select_all, confirmed live via `select policyname from
-- pg_policies where tablename = 'products'`) is wide open, so
-- app/(client)/market.tsx's own client-side filtering was the *only* thing
-- hiding wholesaler rows from clients - a direct /(client)/product/[id] link
-- to a wholesaler's row bypassed it completely.
-- Additive/replacing only. Safe to run once against the existing schema.

drop policy if exists products_select_all on products;

create policy products_select_client_reseller_rows on products
  for select using (
    seller_role = 'reseller'::user_role
    or "current_role"() <> 'client'::user_role
  );
