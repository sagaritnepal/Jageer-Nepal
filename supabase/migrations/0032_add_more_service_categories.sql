-- Add 5 more service categories that came with the latest icon set delivery
-- but didn't exist yet.
with next_sort as (
  select coalesce(max(sort_order), 0) as base from service_categories
)
insert into service_categories (label, description, icon, sort_order, is_active)
select v.label, v.description, v.icon, next_sort.base + v.rn, true
from next_sort, (values
  (1, 'Data Recovery', 'Recovering data from failed drives & devices', '💾'),
  (2, 'Smart Home Setup', 'Smart home device installation & configuration', '🏠'),
  (3, 'PABX & Telephone', 'Office phone system installation & repair', '☎️'),
  (4, 'Solar Panel Installation', 'Solar panel installation & maintenance', '☀️'),
  (5, 'Plumbing Services', 'General plumbing repair & installation', '🪠')
) as v(rn, label, description, icon)
where not exists (
  select 1 from service_categories sc where sc.label = v.label
);
