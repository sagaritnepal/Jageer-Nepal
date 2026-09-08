// app/(reseller)/_layout.tsx
import { Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, WEB_SIDEBAR_MIN_WIDTH, type WebNavItem } from '../../lib/components/web/WebSidebarShell';

// Same 4 sections as the mobile bottom tabs below, just as a persistent
// left rail on web instead - see WebSidebarShell.
const NAV_ITEMS: WebNavItem[] = [
  { href: '/(reseller)/dashboard', label: 'Home', icon: 'home' },
  { href: '/(reseller)/shop', label: 'Shop', icon: 'bag' },
  { href: '/(reseller)/requests', label: 'Requests', icon: 'clipboard' },
  { href: '/(reseller)/finance', label: 'Finance', icon: 'wallet' },
];

export default function ResellerLayout() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => <PortalHeaderBar title={options.title} />,
        tabBarActiveTintColor: ROLE_ACCENT.reseller,
        ...(isWideWeb ? { tabBarStyle: { display: 'none' } } : null),
      }}
    >
        <Tabs.Screen
          name="dashboard"
          options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="shop"
          options={{ title: 'Shop', tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} /> }}
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
          name="finance"
          options={{ title: 'Finance', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
        <Tabs.Screen name="rewards" options={{ href: null, title: 'Rewards' }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Service Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'Request a technician' }} />
        <Tabs.Screen name="request-details" options={{ href: null, title: 'Service details' }} />
        <Tabs.Screen name="edit-request" options={{ href: null, title: 'Edit request' }} />
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
        <Tabs.Screen name="received" options={{ href: null, title: 'Total Received' }} />
        <Tabs.Screen name="paid" options={{ href: null, title: 'Total Paid' }} />
        <Tabs.Screen name="to-receive" options={{ href: null, title: 'To Receive' }} />
        <Tabs.Screen name="to-give" options={{ href: null, title: 'To Give' }} />
        <Tabs.Screen name="bank-accounts" options={{ href: null, title: 'Bank Accounts' }} />
        <Tabs.Screen name="bank-balances" options={{ href: null, title: 'Available Balance' }} />
        <Tabs.Screen name="import-statement" options={{ href: null, title: 'Import Statement' }} />
        <Tabs.Screen name="inventory" options={{ href: null, title: 'Inventory' }} />
        <Tabs.Screen name="report" options={{ href: null, title: 'Report' }} />
      </Tabs>
  );

  return (
    <RoleGuard allow={['reseller']}>
      {isWideWeb ? (
        <WebSidebarShell items={NAV_ITEMS} roleLabel="Reseller">
          {tabs}
        </WebSidebarShell>
      ) : (
        tabs
      )}
    </RoleGuard>
  );
}
