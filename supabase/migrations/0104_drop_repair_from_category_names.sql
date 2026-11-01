-- Drop "Repair" from category names. The illustration is matched by the
-- pinned visual_key (preset label in categoryIcons.ts), so re-pin it to the
-- new preset name first, then rename the visible label.
with m(old_label, new_label) as (values
  ('Computer Repair', 'Computer Desktop'),
  ('Laptop Repair', 'Laptop'),
  ('AC Service & Repair', 'AC Service'),
  ('Printer Repair', 'Printer'),
  ('Scanner Repair', 'Scanner'),
  ('Washing Machine Repair', 'Washing Machine'),
  ('Refrigerator Repair', 'Refrigerator'),
  ('TV Repair', 'TV'),
  ('Microwave Oven Repair', 'Microwave Oven'),
  ('Fan Repair', 'Fan'),
  ('Walkie Talkie Repair', 'Walkie Talkie'),
  ('Water Purifier & RO Repair', 'Water Purifier & RO'),
  ('Vacuum Cleaner Repair', 'Vacuum Cleaner'),
  ('Induction Stove Repair', 'Induction Stove'),
  ('Iron Repair', 'Iron'),
  ('Water Pump Repair', 'Water Pump'),
  ('Projector Repair', 'Projector')
)
update service_categories c set visual_key = m.new_label
from m where c.visual_key = m.old_label or (c.visual_key is null and c.label = m.old_label);

with m(old_label, new_label) as (values
  ('Computer Repair', 'Computer Desktop'),
  ('Laptop Repair', 'Laptop'),
  ('AC Service & Repair', 'AC Service'),
  ('Printer Repair', 'Printer'),
  ('Scanner Repair', 'Scanner'),
  ('Washing Machine Repair', 'Washing Machine'),
  ('Refrigerator Repair', 'Refrigerator'),
  ('TV Repair', 'TV'),
  ('Microwave Oven Repair', 'Microwave Oven'),
  ('Fan Repair', 'Fan'),
  ('Walkie Talkie Repair', 'Walkie Talkie'),
  ('Water Purifier & RO Repair', 'Water Purifier & RO'),
  ('Vacuum Cleaner Repair', 'Vacuum Cleaner'),
  ('Induction Stove Repair', 'Induction Stove'),
  ('Iron Repair', 'Iron'),
  ('Water Pump Repair', 'Water Pump'),
  ('Projector Repair', 'Projector')
)
update service_categories c set label = m.new_label
from m where c.label = m.old_label;
