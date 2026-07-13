// app/(reseller)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function ResellerLayout() {
  return (
    <RoleGuard allow={['reseller']}>
      <Tabs
        screenOptions={{ headerTintColor: ROLE_ACCENT.reseller, tabBarActiveTintColor: ROLE_ACCENT.reseller }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
        <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: () => <TabIcon emoji="📋" /> }} />
        <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: () => <TabIcon emoji="🛍️" /> }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: () => <TabIcon emoji="📦" /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Service Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'New Request' }} />
        <Tabs.Screen name="request-details" options={{ href: null, title: 'Service Details' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
      </Tabs>
    </RoleGuard>
  );
}
