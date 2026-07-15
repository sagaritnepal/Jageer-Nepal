-- Placeholder images for the ~100 catalog items seeded in
-- 0018_seed_electronics_catalog.sql, which intentionally shipped with no
-- photos. One generic, category-representative image per category (not the
-- exact model) sourced from Pexels - free for commercial use, no
-- attribution required (https://www.pexels.com/license/). These are meant
-- to be replaced per-item with real photos via the admin Catalog tab's
-- upload button (0020_catalog_image_upload.sql) whenever available.
-- Additive only. Safe to run once against the existing schema.

update catalog_products set image_url = 'https://images.pexels.com/photos/163065/mobile-phone-android-apps-phone-163065.jpeg'
  where category = 'Mobile Phones' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg'
  where category = 'Laptops & Computers' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/1571459/pexels-photo-1571459.jpeg'
  where category = 'Televisions' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg'
  where category = 'Audio' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/5824488/pexels-photo-5824488.jpeg'
  where category = 'Home Appliances' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/4218546/pexels-photo-4218546.jpeg'
  where category = 'Networking' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/51383/photo-camera-subject-photographer-51383.jpeg'
  where category = 'Cameras' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/159393/gamepad-video-game-controller-game-controller-controller-159393.jpeg'
  where category = 'Gaming' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/12786602/pexels-photo-12786602.jpeg'
  where category = 'Accessories' and image_url is null;

update catalog_products set image_url = 'https://images.pexels.com/photos/29091470/pexels-photo-29091470.jpeg'
  where category = 'Smart Home' and image_url is null;
