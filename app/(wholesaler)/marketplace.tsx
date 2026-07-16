// app/(wholesaler)/marketplace.tsx
import { ScrollView, Text } from 'react-native';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function WholesaleMarketplace() {
  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-4 text-2xl font-bold text-gray-900">Marketplace</Text>
      <MyStorefront
        sellerRole="wholesaler"
        note="This is exactly what resellers see when they browse your shop, with your actual stock on hand and price for each item. Go to Products to change what's listed here."
        emptyText="Nothing listed yet — add items from the Products tab to appear here."
        basePath="/(wholesaler)"
      />
    </ScrollView>
  );
}
