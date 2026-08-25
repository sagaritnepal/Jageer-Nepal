// lib/utils/image.ts

/** Some catalog images were hotlinked as plain http:// (e.g. the
 * qualitycomputer.com.np import in 0024_seed_quality_computer_catalog.sql).
 * Android blocks cleartext network requests by default, so <Image> fails
 * to load these silently - no error, just a permanently blank box. The
 * same source usually serves the identical asset over https:// too, so
 * upgrading the scheme here fixes it everywhere the URL is used, without
 * needing a DB backfill. */
export function toSafeImageUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}
