// app/(client)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function ClientLayout() {
  return (
    <RoleGuard allow={['client']}>
      <Tabs screenOptions={{ header: () => <PortalHeaderBar />, tabBarActiveTintColor: ROLE_ACCENT.client }}>
        <Tabs.Screen
          name="dashboard"
          options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'My Requests',
            tabBarIcon: ({ color, focused }) => <TabIcon name="clipboard" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="market"
          options={{ title: 'Market', tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'New Request' }} />
        <Tabs.Screen name="request-details" options={{ href: null, title: 'Service Details' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="product-orders" options={{ href: null, title: 'My Orders' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
        <Tabs.Screen name="quotes" options={{ href: null, title: 'My Quotes' }} />
        <Tabs.Screen name="quote/[id]" options={{ href: null, title: 'Quote' }} />
      </Tabs>
    </RoleGuard>
  );
}
