// lib/utils/search.ts

/**
 * Case-insensitive match against name and description (model numbers usually
 * live in one of the two). Pass `extra` to also match on a field that isn't
 * on the item itself (e.g. the seller's name, looked up from a separate map).
 */
export function filterBySearch<T extends { name: string; description?: string | null }>(
  items: T[],
  query: string,
  extra?: (item: T) => string | null | undefined
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.name.toLowerCase().includes(q)) return true;
    if ((item.description ?? '').toLowerCase().includes(q)) return true;
    const extraText = extra?.(item);
    return !!extraText && extraText.toLowerCase().includes(q);
  });
}
