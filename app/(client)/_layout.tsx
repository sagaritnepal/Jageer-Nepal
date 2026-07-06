// app/(client)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';

export default function ClientLayout() {
  return (
    <RoleGuard allow={['client']}>
      <Tabs screenOptions={{ headerTintColor: '#1d4ed8', tabBarActiveTintColor: '#1d4ed8' }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="requests" options={{ title: 'My Requests' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'New Request' }} />
      </Tabs>
    </RoleGuard>
  );
}
