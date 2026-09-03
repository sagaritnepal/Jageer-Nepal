// app/(technician)/_layout.tsx
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, type WebNavItem } from '../../lib/components/web/WebSidebarShell';

const NAV_ITEMS: WebNavItem[] = [
  { href: '/(technician)/dashboard', label: 'Home', icon: 'home' },
  { href: '/(technician)/jobs', label: 'My Jobs', icon: 'briefcase' },
  { href: '/(technician)/earnings', label: 'Earnings', icon: 'wallet' },
];

export default function TechnicianLayout() {
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => <PortalHeaderBar title={options.title} />,
        tabBarActiveTintColor: ROLE_ACCENT.technician,
        ...(Platform.OS === 'web' ? { tabBarStyle: { display: 'none' } } : null),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: 'My Jobs', tabBarIcon: ({ color, focused }) => <TabIcon name="briefcase" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: 'Earnings', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      <Tabs.Screen name="rewards" options={{ href: null, title: 'Rewards' }} />
      <Tabs.Screen name="job/[id]" options={{ href: null, title: 'Job Card' }} />
      <Tabs.Screen name="employment" options={{ href: null, title: 'Employment' }} />
      {/* "available" self-assign screen removed: resellers now assign
          technicians directly (see app/(reseller)/request/[id].tsx). Delete
          app/(technician)/available.tsx if you copied it in earlier. */}
    </Tabs>
  );

  return (
    <RoleGuard allow={['technician']}>
      {Platform.OS === 'web' ? (
        <WebSidebarShell items={NAV_ITEMS} roleLabel="Technician">
          {tabs}
        </WebSidebarShell>
      ) : (
        tabs
      )}
    </RoleGuard>
  );
}
