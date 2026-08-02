-- A category's curated icon/illustration is matched by prefixing its
-- current label against a fixed preset list (CATEGORY_ICON_MAP in
-- categoryIcons.ts) - so renaming a category away from its preset name
-- (e.g. "Computer Repair" -> "Computer Desktop") silently lost its
-- illustration with no way back. visual_key pins a category to its preset
-- identity independently of its live label, so a rename only ever changes
-- the displayed name.

alter table service_categories add column if not exists visual_key text;
