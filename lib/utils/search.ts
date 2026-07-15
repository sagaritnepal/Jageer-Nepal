// lib/utils/search.ts

/** Case-insensitive match against name and description (model numbers usually live in one of the two). */
export function filterBySearch<T extends { name: string; description?: string | null }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) => item.name.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
  );
}
