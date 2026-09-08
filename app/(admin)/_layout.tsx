// app/(admin)/_layout.tsx
import { Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, WEB_SIDEBAR_MIN_WIDTH, type WebNavItem } from '../../lib/components/web/WebSidebarShell';

const NAV_ITEMS: WebNavItem[] = [
  { href: '/(admin)/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/(admin)/requests', label: 'Requests', icon: 'clipboard' },
  { href: '/(admin)/reports', label: 'Reports', icon: 'bar-chart' },
  { href: '/(admin)/users', label: 'Users', icon: 'people' },
  { href: '/(admin)/categories', label: 'Categories', icon: 'pricetag' },
  { href: '/(admin)/catalog', label: 'Catalog', icon: 'albums' },
  { href: '/(admin)/products', label: 'Listings', icon: 'bag' },
  { href: '/(admin)/support', label: 'Support', icon: 'headset' },
];

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => <PortalHeaderBar title={options.title} />,
        tabBarActiveTintColor: ROLE_ACCENT.admin,
        ...(isWideWeb ? { tabBarStyle: { display: 'none' } } : null),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Platform Overview',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Service Requests',
          tabBarLabel: 'Requests',
          tabBarIcon: ({ color, focused }) => <TabIcon name="clipboard" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Financial & Platform Reports',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, focused }) => <TabIcon name="bar-chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: 'Users', tabBarIcon: ({ color, focused }) => <TabIcon name="people" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Service Categories',
          tabBarLabel: 'Categories',
          tabBarIcon: ({ color, focused }) => <TabIcon name="pricetag" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Product Catalog',
          tabBarLabel: 'Catalog',
          tabBarIcon: ({ color, focused }) => <TabIcon name="albums" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'All Listings',
          tabBarLabel: 'Listings',
          tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support Tickets',
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, focused }) => <TabIcon name="headset" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
    </Tabs>
  );

  return (
    <RoleGuard allow={['admin']}>
      {isWideWeb ? (
        <WebSidebarShell items={NAV_ITEMS} roleLabel="Admin">
          {tabs}
        </WebSidebarShell>
      ) : (
        tabs
      )}
    </RoleGuard>
  );
}
