// app/(client)/_layout.tsx
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, type WebNavItem } from '../../lib/components/web/WebSidebarShell';

const NAV_ITEMS: WebNavItem[] = [
  { href: '/(client)/dashboard', label: 'Home', icon: 'home' },
  { href: '/(client)/requests', label: 'My Requests', icon: 'clipboard' },
  { href: '/(client)/market', label: 'Market', icon: 'bag' },
];

export default function ClientLayout() {
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => <PortalHeaderBar title={options.title} />,
        tabBarActiveTintColor: ROLE_ACCENT.client,
        ...(Platform.OS === 'web' ? { tabBarStyle: { display: 'none' } } : null),
      }}
    >
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
        options={{
          title: 'Marketplace',
          tabBarLabel: 'Market',
          tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      <Tabs.Screen name="rewards" options={{ href: null, title: 'Rewards' }} />
      <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Request' }} />
      <Tabs.Screen name="new-request" options={{ href: null, title: 'Request a repair' }} />
      <Tabs.Screen name="request-details" options={{ href: null, title: 'Service details' }} />
      <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
      <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
      <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
      <Tabs.Screen name="reseller/[id]" options={{ href: null, title: 'Reseller' }} />
    </Tabs>
  );

  return (
    <RoleGuard allow={['client']}>
      {Platform.OS === 'web' ? (
        <WebSidebarShell items={NAV_ITEMS} roleLabel="Client">
          {tabs}
        </WebSidebarShell>
      ) : (
        tabs
      )}
    </RoleGuard>
  );
}
