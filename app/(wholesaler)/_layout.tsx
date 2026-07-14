// app/(wholesaler)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';

export default function WholesalerLayout() {
  return (
    <RoleGuard allow={['wholesaler']}>
      <Tabs
        screenOptions={{
          headerTintColor: ROLE_ACCENT.wholesaler,
          tabBarActiveTintColor: ROLE_ACCENT.wholesaler,
        }}
      >
        <Tabs.Screen
          name="market"
          options={{ title: 'Market', tabBarIcon: ({ color, focused }) => <TabIcon name="bag" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="orders"
          options={{ title: 'Orders', tabBarIcon: ({ color, focused }) => <TabIcon name="time" color={color} focused={focused} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} /> }}
        />
        <Tabs.Screen name="product/[id]" options={{ href: null, title: 'Bulk Pricing' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
      </Tabs>
    </RoleGuard>
  );
}
