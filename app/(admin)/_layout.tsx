// app/(admin)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';

export default function AdminLayout() {
  return (
    <RoleGuard allow={['admin']}>
      <Tabs screenOptions={{ headerTintColor: '#1d4ed8', tabBarActiveTintColor: '#1d4ed8' }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Overview' }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
        <Tabs.Screen name="users" options={{ title: 'Users' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </RoleGuard>
  );
}
