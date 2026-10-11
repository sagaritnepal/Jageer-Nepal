// lib/utils/nameCaps.ts

/** A party's name the way the app writes it: the first letter of every word in capitals,
 * the rest small ("Ram Sharma"), so names typed or imported as "ram sharma", "Ram Sharma"
 * and "RAM SHARMA" read the same. Used both to show a name (so entries saved earlier look
 * right too) and to save new ones. Names in scripts without letter case, like Devanagari,
 * are unchanged. */
export function nameCaps(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/(^|[\s(\-/.])(\p{L})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}
