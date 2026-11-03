// lib/utils/marketplace.ts

/** Whether a product is in front of customers - and so on the reseller's own Marketplace page: switched on
 * (is_listed), in stock and priced. The same rule the customers' app goes by ((client)/market.tsx), so the
 * two always agree. */
export function isOnMarketplace(product: { is_listed?: boolean | null; stock_level: number; price: number | string }): boolean {
  return product.is_listed !== false && Number(product.stock_level) > 0 && Number(product.price) > 0;
}

/** The search Inventory uses, for the Marketplace too: what was typed, in any case, anywhere in the item's
 * name or its category. Nothing typed matches everything. */
export function matchesItemSearch(name: string, category: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || name.toLowerCase().includes(q) || (category ?? '').toLowerCase().includes(q);
}
