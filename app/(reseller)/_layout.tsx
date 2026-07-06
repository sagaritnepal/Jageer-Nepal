// app/(reseller)/_layout.tsx
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';

export default function ResellerLayout() {
  return (
    <RoleGuard allow={['reseller', 'wholesaler']}>
      <Tabs screenOptions={{ headerTintColor: '#1d4ed8', tabBarActiveTintColor: '#1d4ed8' }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="requests" options={{ title: 'Requests' }} />
        <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="add-product" options={{ href: null, title: 'Add Product' }} />
        <Tabs.Screen name="request/[id]" options={{ href: null, title: 'Assign Technician' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Checkout' }} />
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order Detail' }} />
      </Tabs>
    </RoleGuard>
  );
}
