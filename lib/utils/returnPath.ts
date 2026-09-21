// lib/utils/returnPath.ts

/** Where a multi-step form should land when it finishes or is cancelled.
 *
 * Screens like "New request" are hidden tab screens, so going back from them
 * always fell to the same tab no matter which one opened the form. The
 * opener passes `?from=<tab>` instead, and this turns it into a path.
 *
 * `from` arrives from a URL the user can type, so only a plain tab name is
 * accepted - no slashes, dots or query strings that could send them to some
 * other part of the app (or off it entirely). Anything else falls back to
 * the screen's usual destination. */
export function returnPathOr(basePath: string, from: string | undefined, fallbackTab: string): string {
  const tab = from && /^[a-z][a-z0-9-]{0,30}$/.test(from) ? from : fallbackTab;
  return `${basePath}/${tab}`;
}
