// app/(client)/_layout.tsx
import { Platform, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, WEB_SIDEBAR_MIN_WIDTH, type WebNavItem } from '../../lib/components/web/WebSidebarShell';
import { NotificationPopup } from '../../lib/components/NotificationPopup';
import { useAuthStore } from '../../lib/hooks/useAuth';

const NAV_ITEMS: WebNavItem[] = [
  { href: '/(client)/dashboard', label: 'Home', icon: 'home' },
  { href: '/(client)/requests', label: 'My Requests', icon: 'clipboard' },
  { href: '/(client)/market', label: 'Market', icon: 'bag' },
  { href: '/(client)/contacts', label: 'Contacts', icon: 'people' },
];

// Every client page uses the wider content column (see WebSidebarShell's
// `wideRoutes`), so there is no empty strip beside them on a big screen.
const WIDE_ROUTES = [
  '/dashboard',
  '/requests',
  '/market',
  '/contacts',
  '/profile',
  '/rewards',
  '/request',
  '/new-request',
  '/request-details',
  '/checkout',
  '/order',
  '/product',
  '/reseller',
  '/notifications',
];

export default function ClientLayout() {
  const { width } = useWindowDimensions();
  const userId = useAuthStore((state) => state.session?.user.id);
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => <PortalHeaderBar title={options.title} showNotifications />,
        tabBarActiveTintColor: ROLE_ACCENT.client,
        ...(isWideWeb ? { tabBarStyle: { display: 'none' } } : null),
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
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Saved Contacts',
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color, focused }) => <TabIcon name="people" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      <Tabs.Screen name="rewards" options={{ href: null, title: 'Rewards' }} />
      {/* Where the notification bell leads. It has its own header (with a back
          arrow), so the bell is not repeated on it. */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
          header: () => <PortalHeaderBar title="Notifications" backTo="/(client)/dashboard" />,
        }}
      />
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
      <View style={{ flex: 1 }}>
        {isWideWeb ? (
          <WebSidebarShell items={NAV_ITEMS} roleLabel="Client" wideRoutes={WIDE_ROUTES}>
            {tabs}
          </WebSidebarShell>
        ) : (
          tabs
        )}
        <NotificationPopup userId={userId} portal="client" />
      </View>
    </RoleGuard>
  );
}
