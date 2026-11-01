// lib/utils/appUpdate.ts

/** Newest GitHub Release of the repo that builds the APK (.github/workflows/build-android.yml). The
 * workflow tags each release "v<versionCode>" and attaches app-release.apk. */
export const LATEST_RELEASE_API = 'https://api.github.com/repos/sagaritnepal/Jageer-Nepal/releases/latest';

/** The APK's download link when `release` is newer than the installed build, else null. Anything odd in the
 * response (no tag, no .apk, not a number) counts as "no update" - this must never throw or nag by mistake. */
export function pickUpdate(installedVersionCode: number, release: unknown): string | null {
  const r = release as { tag_name?: unknown; assets?: { name?: unknown; browser_download_url?: unknown }[] } | null;
  const code = Number(String(r?.tag_name ?? '').replace(/^v/, ''));
  if (!Number.isFinite(code) || code <= installedVersionCode) return null;
  const apk = (r?.assets ?? []).find((a) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
  return typeof apk?.browser_download_url === 'string' ? apk.browser_download_url : null;
}
