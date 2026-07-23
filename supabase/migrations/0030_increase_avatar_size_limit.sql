-- The avatars bucket was capped at 2MB (0014_avatars_and_skills.sql), which
-- a full-resolution phone camera photo can exceed even after JPEG
-- compression. The app now resizes images client-side before upload, but
-- bump the bucket limit to match the other image buckets (catalog-images,
-- request-photos) as a safety net for any edge case that still slips through.
-- Additive only. Safe to run once against the existing schema.

update storage.buckets set file_size_limit = 5242880 where id = 'avatars';
