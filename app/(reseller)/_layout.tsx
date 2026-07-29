// app/(reseller)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function ResellerLayout() {
  return (
    <RoleGuard allow={['reseller']}>
      <Tabs
        backBehavior="history"
        screenOptions={{ header: ({ options }) => <PortalHeaderBar title={options.title} />, tabBarActiveTintColor: ROLE_ACCENT.reseller }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'My Jobs',
            tabBarLabel: 'Requests',
            tabBarIcon: ({ color, focused }) => <TabIcon name="clipboard" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{ title: 'Shop', tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="finance"
          options={{ title: 'Finance', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Service Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'Request a technician' }} />
        <Tabs.Screen name="request-details" options={{ href: null, title: 'Service details' }} />
        <Tabs.Screen name="wholesale" options={{ href: null, title: 'Buy From Wholesaler' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
        <Tabs.Screen name="catalog/[id]" options={{ href: null, title: 'Product Details' }} />
        <Tabs.Screen name="technician/[id]" options={{ href: null, title: 'Work History' }} />
        <Tabs.Screen name="customers" options={{ href: null, title: 'My Customers' }} />
        <Tabs.Screen name="customer/[id]" options={{ href: null, title: 'Customer' }} />
        <Tabs.Screen name="transactions" options={{ href: null, title: 'Transactions' }} />
        <Tabs.Screen name="quick-payment" options={{ href: null, title: 'Quick Payment' }} />
      </Tabs>
    </RoleGuard>
  );
}
