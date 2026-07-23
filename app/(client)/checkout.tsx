// app/(client)/checkout.tsx
import { CheckoutScreen } from '../../lib/components/CheckoutScreen';

export default function ClientCheckout() {
  return <CheckoutScreen redirectTo="/(client)/requests?type=orders" />;
}
