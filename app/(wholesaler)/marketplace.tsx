// app/(wholesaler)/marketplace.tsx
import { ScrollView } from 'react-native';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function WholesaleMarketplace() {
  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <MyStorefront
        sellerRole="wholesaler"
        note="Everything you carry stays visible here. Flip Available off to hide an item from resellers without losing your stock count — you'll still see it, just resellers won't."
        emptyText="Nothing listed yet — add items from the Products tab to appear here."
        basePath="/(wholesaler)"
      />
    </ScrollView>
  );
}
