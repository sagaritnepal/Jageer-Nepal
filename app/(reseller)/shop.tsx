// app/(reseller)/shop.tsx
import { View, ScrollView } from 'react-native';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function Shop() {
  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <MyStorefront
          sellerRole="reseller"
          note="Everything you've bought from Wholesale stays visible here. Flip Available off to hide an item from customers without losing your stock count — you'll still see it, just customers won't."
          emptyText="Buy stock from a wholesaler and it'll show up here."
          basePath="/(reseller)"
        />
      </ScrollView>
    </View>
  );
}
