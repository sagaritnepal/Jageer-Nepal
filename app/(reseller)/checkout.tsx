// app/(reseller)/checkout.tsx
import { CheckoutScreen } from '../../lib/components/CheckoutScreen';

export default function Checkout() {
  return <CheckoutScreen redirectTo="/(reseller)/orders" />;
}
