// app/(reseller)/shop.tsx
import { Redirect } from 'expo-router';

// The shop is part of Shop & Services now (the Products tab of the dashboard); this keeps old links working.
export default function Shop() {
  return <Redirect href={'/(reseller)/dashboard?tab=products' as never} />;
}
