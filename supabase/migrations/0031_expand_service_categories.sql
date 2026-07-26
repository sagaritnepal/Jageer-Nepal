-- Hide the two categories that no longer fit the catalog, and add a much
-- wider set of common home/office appliance & IT service categories.
update service_categories
set is_active = false
where label in ('Hardware & Installation', 'Network Issues');

with next_sort as (
  select coalesce(max(sort_order), 0) as base from service_categories
)
insert into service_categories (label, description, icon, sort_order, is_active)
select v.label, v.description, v.icon, next_sort.base + v.rn, true
from next_sort, (values
  (1, 'Server Maintenance', 'Server setup, repair & maintenance', '🖥️'),
  (2, 'Printer Repair', 'Printers, cartridges & repairs', '🖨️'),
  (3, 'Scanner Repair', 'Scanner setup & repair', '🖨️'),
  (4, 'Washing Machine Repair', 'Washing machine service & repair', '🧺'),
  (5, 'Geyser & Water Heater', 'Geyser installation & repair', '🚿'),
  (6, 'Refrigerator Repair', 'Fridge service & repair', '🧊'),
  (7, 'TV Repair', 'Television repair & setup', '📺'),
  (8, 'Speaker & Sound System', 'Speakers & audio system repair', '🔊'),
  (9, 'Attendance & Biometric Systems', 'Biometric attendance device setup', '🖐️'),
  (10, 'Microwave Oven Repair', 'Microwave & oven repair', '🍽️'),
  (11, 'Fan Repair', 'Ceiling & table fan repair', '🌀'),
  (12, 'Walkie Talkie Repair', 'Walkie talkie service & repair', '📻'),
  (13, 'WiFi Router Setup', 'Router installation & configuration', '📶'),
  (14, 'Network Switches & Cabling', 'Switches, cabling & networking', '🔌'),
  (15, 'Water Purifier & RO Repair', 'RO & water purifier service', '💧'),
  (16, 'Vacuum Cleaner Repair', 'Vacuum cleaner service & repair', '🧹'),
  (17, 'Induction Stove Repair', 'Induction & electric stove repair', '🍳'),
  (18, 'Iron Repair', 'Electric iron repair', '👔'),
  (19, 'Water Pump Repair', 'Water pump installation & repair', '🚰'),
  (20, 'Projector Repair', 'Projector setup & repair', '📽️')
) as v(rn, label, description, icon)
where not exists (
  select 1 from service_categories sc where sc.label = v.label
);
