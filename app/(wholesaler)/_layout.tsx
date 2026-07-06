// app/(wholesaler)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function WholesalerLayout() {
  return (
    <RoleGuard allow={['wholesaler']}>
      <Tabs
        screenOptions={{
          headerTintColor: ROLE_ACCENT.wholesaler,
          tabBarActiveTintColor: ROLE_ACCENT.wholesaler,
        }}
      >
        <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: () => <TabIcon emoji="📦" /> }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: () => <TabIcon emoji="📋" /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Bulk Pricing' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
      </Tabs>
    </RoleGuard>
  );
}
