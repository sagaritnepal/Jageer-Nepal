// app/(reseller)/shop.tsx
import { View, ScrollView } from 'react-native';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function Shop() {
  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <MyStorefront
          sellerRole="reseller"
          emptyText="Buy stock from a wholesaler and it'll show up here."
          basePath="/(reseller)"
        />
      </ScrollView>
    </View>
  );
}
