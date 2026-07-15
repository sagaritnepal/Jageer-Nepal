// app/(wholesaler)/market.tsx
import { Text, ScrollView } from 'react-native';
import { CatalogStockingList } from '../../lib/components/CatalogStockingList';

export default function WholesaleMarket() {
  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">Stock Your Shop</Text>
      <Text className="mb-5 text-sm text-gray-500">
        Set quantity and your price for anything you carry — resellers buy from you at this price.
      </Text>

      <CatalogStockingList priceLabel="Your price to resellers" />
    </ScrollView>
  );
}
