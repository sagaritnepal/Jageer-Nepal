// app/(technician)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';

export default function TechnicianLayout() {
  return (
    <RoleGuard allow={['technician']}>
      <Tabs screenOptions={{ headerTintColor: '#1d4ed8', tabBarActiveTintColor: '#1d4ed8' }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="jobs" options={{ title: 'My Jobs' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="job/[id]" options={{ href: null, title: 'Job Card' }} />
        {/* "available" self-assign screen removed: resellers now assign
            technicians directly (see app/(reseller)/request/[id].tsx). Delete
            app/(technician)/available.tsx if you copied it in earlier. */}
      </Tabs>
    </RoleGuard>
  );
}
