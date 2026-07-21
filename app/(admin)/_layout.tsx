// app/(admin)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function AdminLayout() {
  return (
    <RoleGuard allow={['admin']}>
      <Tabs screenOptions={{ header: ({ options }) => <PortalHeaderBar title={options.title} />, tabBarActiveTintColor: ROLE_ACCENT.admin }}>
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
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }}
        />
      </Tabs>
    </RoleGuard>
  );
}
