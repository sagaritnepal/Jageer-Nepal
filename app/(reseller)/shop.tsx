// app/(reseller)/shop.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MyStorefront } from '../../lib/components/MyStorefront';

export default function Shop() {
  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Pressable
        onPress={() => router.push('/(reseller)/wholesale')}
        className="mb-4 flex-row items-center justify-between rounded-xl bg-orange-500 px-4 py-3.5"
      >
        <View className="flex-row items-center gap-2.5">
          <Ionicons name="cart-outline" size={18} color="white" />
          <Text className="text-sm font-semibold text-white">Buy From Wholesaler</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="white" />
      </Pressable>

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
