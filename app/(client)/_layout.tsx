// app/(client)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function ClientLayout() {
  return (
    <RoleGuard allow={['client']}>
      <Tabs screenOptions={{ headerTintColor: ROLE_ACCENT.client, tabBarActiveTintColor: ROLE_ACCENT.client }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
        <Tabs.Screen
          name="requests"
          options={{ title: 'My Requests', tabBarIcon: () => <TabIcon emoji="📋" /> }}
        />
        <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: () => <TabIcon emoji="🛍️" /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'New Request' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="product-orders" options={{ href: null, title: 'My Orders' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
      </Tabs>
    </RoleGuard>
  );
}
