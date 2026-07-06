// app/index.tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/hooks/useAuth';

const ROLE_HOME: Record<string, string> = {
  client: '/(client)/dashboard',
  technician: '/(technician)/dashboard',
  reseller: '/(reseller)/dashboard',
  wholesaler: '/(reseller)/dashboard', // shares the reseller area for now
  admin: '/(admin)/dashboard',
};

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Session exists but profile hasn't loaded yet - the AuthGate's loading
  // state should normally prevent this, but guard anyway.
  if (!profile) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={(ROLE_HOME[profile.role] ?? '/(client)/dashboard') as never} />;
}
