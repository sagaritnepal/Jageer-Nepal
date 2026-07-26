// app/(reseller)/shop.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CatalogStockingList } from '../../lib/components/CatalogStockingList';

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

      <Text className="mb-4 text-sm text-gray-500">
        This is your shop, exactly as customers see it in the Marketplace. Only items you've bought from
        Wholesale show up here — the quantity you can set is capped by your purchases. Flip a switch to pull
        something off the market without losing your stock count.
      </Text>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <CatalogStockingList
          priceLabel="Your price to customers"
          capToPurchasedStock
          onlyStocked
          useFilterSheet
          showStockBadge
          basePath="/(reseller)"
        />
      </ScrollView>
    </View>
  );
}
