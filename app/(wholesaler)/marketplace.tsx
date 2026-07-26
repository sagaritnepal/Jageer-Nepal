// app/(wholesaler)/marketplace.tsx
import { ScrollView } from 'react-native';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function WholesaleMarketplace() {
  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <MyStorefront
        sellerRole="wholesaler"
        note="This is what resellers see when they browse your shop. Flip Available off to pull an item off the market, and tap a price to change it any time."
        emptyText="Nothing listed yet — add items from the Products tab to appear here."
        basePath="/(wholesaler)"
      />
    </ScrollView>
  );
}
