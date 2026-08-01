// app/(technician)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function TechnicianLayout() {
  return (
    <RoleGuard allow={['technician']}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          header: ({ options }) => <PortalHeaderBar title={options.title} />,
          tabBarActiveTintColor: ROLE_ACCENT.technician,
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
        {/* "available" self-assign screen removed: resellers now assign
            technicians directly (see app/(reseller)/request/[id].tsx). Delete
            app/(technician)/available.tsx if you copied it in earlier. */}
      </Tabs>
    </RoleGuard>
  );
}
