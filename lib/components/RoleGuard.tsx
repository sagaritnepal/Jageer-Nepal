// lib/components/RoleGuard.tsx
import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useAuthStore } from '../hooks/useAuth';
import type { UserRole } from '../../types/database.types';

export function RoleGuard({ allow, children }: PropsWithChildren<{ allow: UserRole[] }>) {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!allow.includes(profile.role)) {
    // Signed in, but wrong area (e.g. a technician hitting the client tabs
    // directly via a deep link) - bounce back to the role-based root.
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
