// lib/components/RoleGuard.tsx
import { Redirect, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { useAuthStore } from '../hooks/useAuth';
import { samePathForRole } from '../constants/roleRoutes';
import type { UserRole } from '../../types/database.types';

/** The query values worth carrying across a redirect - which category the
 * form is for, which tab opened it, and so on. Expo Router mixes the
 * route's own segments into these params, and only real query values come
 * through as plain strings. */
function queryParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function RoleGuard({ allow, children }: PropsWithChildren<{ allow: UserRole[] }>) {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  const role = profile?.role;
  const wrongPortal = !!role && !allow.includes(role);
  // Signed in, but this screen belongs to another portal. Portals share
  // their addresses (the group name never appears in the URL), so a
  // refresh, a bookmark or a pasted link often lands here rather than in
  // the user's own portal. If they have the same screen, move them onto it
  // with the query string intact instead of throwing the page away.
  //
  // This runs as a navigation rather than a <Redirect>: a redirect to
  // another group's path is resolved against the group we're currently in
  // and quietly ends up at the root, which is the bug being fixed here.
  const ownPath = wrongPortal && role ? samePathForRole(role, pathname) : null;
  const search = ownPath ? queryParams(params) : null;

  useEffect(() => {
    if (!ownPath) return;
    router.replace({ pathname: ownPath, params: search ?? {} } as never);
  }, [ownPath, search]);

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (wrongPortal) {
    // Nothing to render while the navigation above runs; portals with no
    // matching screen just go home.
    return ownPath ? null : <Redirect href="/" />;
  }

  return <>{children}</>;
}
