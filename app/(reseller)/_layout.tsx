// app/(reseller)/_layout.tsx
import { Platform, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, WEB_SIDEBAR_MIN_WIDTH, type WebNavItem } from '../../lib/components/web/WebSidebarShell';
import { ResellerHoldNotice } from '../../lib/components/HoldNotice';
import { ResellerLeaveRequestNotice } from '../../lib/components/LeaveRequestNotice';
import { NotificationPopup } from '../../lib/components/NotificationPopup';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { shortcuts as financeShortcuts, FINANCE_WIDE_ROUTES } from '../../lib/components/finance/FinanceDashboardScreen';

// The mobile bottom tabs below, as a persistent left rail on web instead - see
// WebSidebarShell. The Work Hub is not in it: on web it is the "My Work Hub"
// button at the top right of Requests (the phone keeps its Work tab). Finance's own shortcuts
// (Payment In, Purchase, Report, ...) are nested under it too, reusing the
// exact same list the Finance dashboard's tiles use, so switching between
// them never means going back to that dashboard to pick another tile.
// Already reachable from the Day Book's "What are you recording?" menu.
const DAYBOOK_ENTRY_KEYS = new Set(['payment-in', 'payment-out', 'sales', 'purchase', 'expenses']);

// The order Finance's pages run down the side panel (the Finance page's own tiles keep theirs).
// Anything not named here goes after them, in the order it comes.
const FINANCE_NAV_ORDER = [
  'daybook',
  'customers',
  'transactions',
  'import-statement',
  'inventory',
  'report',
  'quotation',
  'bank-accounts',
  'buy-stock',
];
const financeNavRank = (key: string) => {
  const i = FINANCE_NAV_ORDER.indexOf(key);
  return i === -1 ? FINANCE_NAV_ORDER.length : i;
};

// Every report there is (the same list the Report page itself shows, see ReportScreen.tsx),
// nested under Report in the side panel instead of sitting flat beside Day Book and Ledger -
// a family of report types one step in, all reachable without opening the Report page first.
const REPORT_FAMILY: WebNavItem[] = [
  { href: '/(reseller)/sales-report', label: 'Sales Report', icon: 'trending-up' },
  { href: '/(reseller)/purchase-report', label: 'Purchase Report', icon: 'cart' },
  { href: '/(reseller)/expense-report', label: 'Expense Report', icon: 'receipt' },
  {
    href: '/(reseller)/to-receive',
    label: 'Receivable',
    icon: 'people',
    children: [{ href: '/(reseller)/received', label: 'Total Received', icon: 'arrow-down-circle' }],
  },
  {
    href: '/(reseller)/to-give',
    label: 'Payable',
    icon: 'storefront',
    children: [{ href: '/(reseller)/paid', label: 'Total Paid', icon: 'arrow-up-circle' }],
  },
];

const NAV_ITEMS: WebNavItem[] = [
  { href: '/(reseller)/dashboard', label: 'Home', icon: 'home' },
  { href: '/(reseller)/shop', label: 'Shop', icon: 'bag' },
  { href: '/(reseller)/requests', label: 'Requests', icon: 'clipboard' },
  {
    href: '/(reseller)/finance',
    label: 'Finance',
    icon: 'wallet',
    children: financeShortcuts('/(reseller)')
      .filter((s) => !DAYBOOK_ENTRY_KEYS.has(s.key))
      .sort((a, b) => financeNavRank(a.key) - financeNavRank(b.key))
      .map((s) => (s.key === 'report' ? { href: s.href, label: s.label, icon: s.icon, children: REPORT_FAMILY } : { href: s.href, label: s.label, icon: s.icon })),
  },
];

// Every other reseller page uses the wider content column too (like Finance's
// pages), so there is no empty strip beside them on a big screen - see
// WebSidebarShell's `wideRoutes`.
const MAIN_WIDE_ROUTES = [
  '/dashboard',
  '/shop',
  '/requests',
  '/workhub',
  '/wholesale',
  '/quotation',
  '/profile',
  '/company',
  '/employees',
  '/employee',
  '/rewards',
  '/request',
  '/new-request',
  '/request-details',
  '/edit-request',
  '/checkout',
  '/order',
  '/product',
  '/catalog',
  '/technician',
  '/team-activity',
  '/notifications',
];
const WIDE_ROUTES = [...FINANCE_WIDE_ROUTES, ...MAIN_WIDE_ROUTES];

export default function ResellerLayout() {
  const { width } = useWindowDimensions();
  const userId = useAuthStore((state) => state.session?.user.id);
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => (
          <PortalHeaderBar
            title={options.title}
            hideAccount={isWideWeb}
            showNotifications
            left={options.headerLeft?.({ canGoBack: false })}
            right={options.headerRight?.({ canGoBack: false })}
          />
        ),
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
            title: 'My Requests',
            tabBarLabel: 'Requests',
            tabBarIcon: ({ color, focused }) => <TabIcon name="clipboard" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="workhub"
          options={{
            title: 'Work Hub',
            tabBarLabel: 'Work',
            tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{ title: 'Finance', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
        <Tabs.Screen name="company" options={{ href: null, title: 'Company Details' }} />
        <Tabs.Screen
          name="employees"
          options={{
            href: null,
            title: 'Team',
            header: ({ options }) => <PortalHeaderBar title={options.title} backTo="/(reseller)/profile" showNotifications />,
          }}
        />
        <Tabs.Screen
          name="team-activity"
          options={{
            href: null,
            title: 'Team Activity',
            header: ({ options }) => <PortalHeaderBar title={options.title} backTo="/(reseller)/employees" showNotifications />,
          }}
        />
        <Tabs.Screen
          name="employee/[id]"
          options={{
            href: null,
            title: 'Employee',
            header: ({ options }) => <PortalHeaderBar title={options.title} backTo="/(reseller)/employees" showNotifications />,
          }}
        />
        <Tabs.Screen name="rewards" options={{ href: null, title: 'Rewards' }} />
        {/* Where the notification bell leads. It has its own header (with a
            back arrow), so the bell is not repeated on it. */}
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
            title: 'Notifications',
            header: () => <PortalHeaderBar title="Notifications" backTo="/(reseller)/dashboard" />,
          }}
        />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Service Request' }} />
        <Tabs.Screen name="new-request" options={{ href: null, title: 'Request a technician' }} />
        <Tabs.Screen name="request-details" options={{ href: null, title: 'Service details' }} />
        <Tabs.Screen name="edit-request" options={{ href: null, title: 'Edit request' }} />
        <Tabs.Screen name="quotation/new" options={{ href: null, title: 'Generate Quotation' }} />
        <Tabs.Screen name="wholesale" options={{ href: null, title: 'Buy From Wholesaler' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Product' }} />
        <Tabs.Screen name="catalog/[id]" options={{ href: null, title: 'Product Details' }} />
        <Tabs.Screen name="technician/[id]" options={{ href: null, title: 'Work History' }} />
        <Tabs.Screen name="customers" options={{ href: null, title: 'Ledger' }} />
        <Tabs.Screen name="customer/[id]" options={{ href: null, title: 'Customer' }} />
        <Tabs.Screen name="transactions" options={{ href: null, title: 'Statement' }} />
        <Tabs.Screen name="quick-payment" options={{ href: null, title: 'Quick Payment' }} />
        <Tabs.Screen name="received" options={{ href: null, title: 'Total Received' }} />
        <Tabs.Screen name="paid" options={{ href: null, title: 'Total Paid' }} />
        <Tabs.Screen name="sales-report" options={{ href: null, title: 'Sales Report' }} />
        <Tabs.Screen name="purchase-report" options={{ href: null, title: 'Purchase Report' }} />
        <Tabs.Screen name="expense-report" options={{ href: null, title: 'Expense Report' }} />
        <Tabs.Screen name="to-receive" options={{ href: null, title: 'Receivable' }} />
        <Tabs.Screen name="to-give" options={{ href: null, title: 'Payable' }} />
        <Tabs.Screen name="bank-accounts" options={{ href: null, title: 'Bank Accounts' }} />
        <Tabs.Screen name="bank-balances" options={{ href: null, title: 'Available Balance' }} />
        <Tabs.Screen name="import-statement" options={{ href: null, title: 'Import Statement' }} />
        <Tabs.Screen name="inventory" options={{ href: null, title: 'Inventory' }} />
        <Tabs.Screen name="report" options={{ href: null, title: 'Report' }} />
        <Tabs.Screen name="daybook" options={{ href: null, title: 'Day Book' }} />
      </Tabs>
  );

  return (
    <RoleGuard allow={['reseller']}>
      {/* The hold-request capsule sits outside the tabs so it shows over
          whichever tab (or the sidebar) is open. */}
      <View style={{ flex: 1 }}>
        {isWideWeb ? (
          <WebSidebarShell items={NAV_ITEMS} roleLabel="Reseller" profileHref="/(reseller)/profile" wideRoutes={WIDE_ROUTES}>
            {tabs}
          </WebSidebarShell>
        ) : (
          tabs
        )}
        <ResellerHoldNotice resellerId={userId} />
        <NotificationPopup userId={userId} portal="reseller" />
        <ResellerLeaveRequestNotice resellerId={userId} />
      </View>
    </RoleGuard>
  );
}
