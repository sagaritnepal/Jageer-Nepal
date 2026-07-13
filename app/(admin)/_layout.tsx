// app/(admin)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function AdminLayout() {
  return (
    <RoleGuard allow={['admin']}>
      <Tabs screenOptions={{ headerTintColor: ROLE_ACCENT.admin, tabBarActiveTintColor: ROLE_ACCENT.admin }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Overview', tabBarIcon: () => <TabIcon emoji="📊" /> }} />
        <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: () => <TabIcon emoji="🧰" /> }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: () => <TabIcon emoji="📈" /> }} />
        <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: () => <TabIcon emoji="👥" /> }} />
        <Tabs.Screen name="categories" options={{ title: 'Categories', tabBarIcon: () => <TabIcon emoji="🏷️" /> }} />
        <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: () => <TabIcon emoji="🛍️" /> }} />
        <Tabs.Screen name="support" options={{ title: 'Support', tabBarIcon: () => <TabIcon emoji="🎧" /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
      </Tabs>
    </RoleGuard>
  );
}
