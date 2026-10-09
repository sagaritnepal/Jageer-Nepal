// lib/constants/roleRoutes.ts
import type { UserRole } from '../../types/database.types';

/** The screens each portal has, by URL path.
 *
 * Every portal is its own route group, and the group name never appears in
 * the address - so "/requests" belongs to the customer app, the reseller
 * portal and admin all at once. On a cold load (a refresh, a bookmark, a
 * pasted link) the router picks the first group that matches, which is
 * often the wrong one for whoever is signed in; RoleGuard then uses this
 * list to send them to the same screen in their own portal instead of
 * dumping them on their home page - see RoleGuard.
 *
 * Only fixed paths are listed. A screen with an id in it (request/[id],
 * order/[id]) is left out on purpose: the same id rarely means the same
 * thing in two portals, so those fall back to home.
 *
 * Keep in step with the files under app/(role)/ - a missing entry only
 * costs a redirect to home, a wrong one lands on an unknown route. */
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  client: [
    'checkout', 'contacts', 'dashboard', 'market', 'new-request', 'notifications', 'profile', 'request-details', 'requests',
    'rewards',
  ],
  reseller: [
    'bank-accounts', 'bank-balances', 'checkout', 'company', 'customers', 'dashboard', 'daybook', 'edit-request',
    'employees', 'expense-report', 'finance', 'import-statement', 'inventory', 'new-request', 'notifications', 'paid', 'profile',
    'purchase-report', 'quick-payment', 'quotation/new', 'received', 'report', 'request-details', 'requests', 'rewards',
    'sales-report', 'shop', 'to-give', 'to-receive',
    'transactions', 'wholesale',
  ],
  technician: [
    'dashboard', 'earnings', 'employment', 'inbox', 'jobs', 'notifications', 'profile', 'rewards', 'statement', 'workhub',
  ],
  wholesaler: [
    'bank-accounts', 'bank-balances', 'customers', 'daybook', 'expense-report', 'finance', 'import-statement', 'inventory',
    'market', 'marketplace', 'orders', 'paid', 'profile', 'purchase-report', 'quick-payment', 'received', 'report',
    'sales-report', 'to-give', 'to-receive',
    'transactions', 'rewards',
  ],
  admin: ['catalog', 'categories', 'dashboard', 'products', 'profile', 'reports', 'requests', 'support', 'users'],
};

/** The same screen inside `role`'s own portal, or null if it has no such
 * screen. `pathname` is the browser path, e.g. "/request-details". */
export function samePathForRole(role: UserRole, pathname: string): string | null {
  const path = pathname.replace(/^\/+/, '');
  return ROLE_ROUTES[role]?.includes(path) ? `/(${role})/${path}` : null;
}
