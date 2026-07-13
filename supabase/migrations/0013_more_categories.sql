-- Add more service categories to the admin-managed catalog (service_categories,
-- see 0004_admin_catalog.sql). Additive only.

insert into service_categories (label, description, icon, sort_order) values
  ('CCTV & Surveillance', 'Cameras & security systems', '📹', 7),
  ('Computer Repair', 'Desktops & troubleshooting', '🖥️', 8),
  ('Laptop Repair', 'Screen, battery & repairs', '💻', 9),
  ('Door Lock & Access', 'Smart & digital locks', '🔒', 10),
  ('Intercom Systems', 'Video & audio door phones', '📞', 11),
  ('AC Service & Repair', 'Installation & maintenance', '❄️', 12),
  ('Electrical Work', 'Wiring & fittings', '⚡', 13),
  ('UPS & Inverter', 'Backup power setup', '🔋', 14)
on conflict (label) do nothing;
