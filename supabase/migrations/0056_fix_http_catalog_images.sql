-- The qualitycomputer.com.np catalog import (0024) hotlinked images as
-- plain http://, which Android's cleartext-traffic block makes <Image>
-- fail to load silently - the "Shop" tab's product photos going blank
-- with no error. The same host serves the identical asset over https://,
-- so upgrade the scheme rather than losing the photo. Covers both
-- catalog_products (the template) and products (the seller's snapshot -
-- see 0023's note on why these are copied, not referenced live).
-- Additive only. Safe to run once against the existing schema.

update catalog_products
set image_url = 'https://' || substring(image_url from 8)
where image_url like 'http://%';

update products
set image_url = 'https://' || substring(image_url from 8)
where image_url like 'http://%';
