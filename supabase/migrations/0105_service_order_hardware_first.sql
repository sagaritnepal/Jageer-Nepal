-- 0105: the Services grid shows hardware first (CCTV, computers, printers ... then home appliances) and the
-- software / online services (data recovery, cybersecurity, cloud, websites, marketing) last.
--
-- Only sort_order changes: hardware 1.., any service not named below (one added later in admin) 500.. in its old
-- order, software 900... Run once in the Supabase SQL Editor; running it again gives the same order.
with wanted(label, pos) as (
  select label, pos from unnest(array[
    -- hardware: devices and systems
    'CCTV & Surveillance', 'Computer Desktop', 'Laptop', 'Printer', 'Scanner', 'UPS & Inverter', 'Server Maintenance',
    'Network Switches & Cabling', 'WiFi Router Setup', 'Intercom Systems', 'PABX & Telephone',
    'Attendance & Biometric Systems', 'Door Lock & Access', 'Smart Home Setup', 'Solar Panel Installation',
    'Electrical Work',
    -- hardware: home appliances
    'AC Service', 'TV', 'Projector', 'Speaker & Sound System', 'Walkie Talkie', 'Refrigerator', 'Washing Machine',
    'Microwave Oven', 'Geyser & Water Heater', 'Water Purifier & RO', 'Induction Stove', 'Iron', 'Fan',
    'Vacuum Cleaner', 'Water Pump', 'Plumbing Services'
  ]) with ordinality as t(label, pos)
  union all
  -- software and online services, last
  select label, 900 + pos from unnest(array[
    'Data Recovery', 'Cybersecurity', 'Cloud Solutions', 'Website & App Design', 'Digital Marketing'
  ]) with ordinality as t(label, pos)
),
placed as (
  select c.id,
         coalesce(
           w.pos,
           500 + row_number() over (partition by w.pos is null order by c.sort_order, c.label)
         ) as pos
  from service_categories c
  left join wanted w on lower(trim(w.label)) = lower(trim(c.label))
)
update service_categories c
set sort_order = p.pos
from placed p
where p.id = c.id;

-- Check: the grid's order, top to bottom.
select sort_order, label, is_active from service_categories order by sort_order;
