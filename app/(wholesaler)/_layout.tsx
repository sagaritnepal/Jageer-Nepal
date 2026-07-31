// app/(wholesaler)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function WholesalerLayout() {
  return (
    <RoleGuard allow={['wholesaler']}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          header: ({ options }) => <PortalHeaderBar title={options.title} />,
          tabBarActiveTintColor: ROLE_ACCENT.wholesaler,
        }}
      >
        <Tabs.Screen
          name="market"
          options={{
            title: 'Stock Your Shop',
            tabBarLabel: 'Products',
            tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{ title: 'Marketplace', tabBarIcon: ({ color, focused }) => <TabIcon name="storefront" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Bulk Orders',
            tabBarLabel: 'Orders',
            tabBarIcon: ({ color, focused }) => <TabIcon name="time" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{ title: 'Finance', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Bulk Pricing' }} />
        <Tabs.Screen name="catalog/[id]" options={{ href: null, title: 'Product Details' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="customers" options={{ href: null, title: 'My Customers' }} />
        <Tabs.Screen name="customer/[id]" options={{ href: null, title: 'Customer' }} />
        <Tabs.Screen name="transactions" options={{ href: null, title: 'Transactions' }} />
        <Tabs.Screen name="quick-payment" options={{ href: null, title: 'Quick Payment' }} />
        <Tabs.Screen name="received" options={{ href: null, title: 'Total Received' }} />
        <Tabs.Screen name="paid" options={{ href: null, title: 'Total Paid' }} />
        <Tabs.Screen name="bank-accounts" options={{ href: null, title: 'Bank Accounts' }} />
      </Tabs>
    </RoleGuard>
  );
}
