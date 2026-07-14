// app/(technician)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function TechnicianLayout() {
  return (
    <RoleGuard allow={['technician']}>
      <Tabs
        screenOptions={{
          headerTintColor: ROLE_ACCENT.technician,
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
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="job/[id]" options={{ href: null, title: 'Job Card' }} />
        {/* "available" self-assign screen removed: resellers now assign
            technicians directly (see app/(reseller)/request/[id].tsx). Delete
            app/(technician)/available.tsx if you copied it in earlier. */}
      </Tabs>
    </RoleGuard>
  );
}
