// app/(reseller)/shop.tsx
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CatalogStockingList } from '../../lib/components/CatalogStockingList';
import { MyStorefront } from '../../lib/components/MyStorefront';

type ViewMode = 'products' | 'storefront';

function MyListings() {
  return (
    <>
      <Text className="mb-1 text-[15px] font-bold text-gray-900">My Inventory</Text>
      <Text className="mb-4 text-sm text-gray-500">
        Only items you've bought from Wholesale show up here — the quantity you can set is capped by your
        purchases. Flip a switch to pull something off the market without losing your stock count.
      </Text>
      <CatalogStockingList priceLabel="Your price to customers" capToPurchasedStock onlyStocked basePath="/(reseller)" />
    </>
  );
}

export default function Shop() {
  const [viewMode, setViewMode] = useState<ViewMode>('products');

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

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setViewMode('products')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'products' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'products' ? 'text-white' : 'text-gray-600'}`}>
            Products
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('storefront')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'storefront' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'storefront' ? 'text-white' : 'text-gray-600'}`}>
            Marketplace
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {viewMode === 'products' ? (
          <MyListings />
        ) : (
          <MyStorefront
            sellerRole="reseller"
            note="This is exactly what customers see when they browse your shop in the Marketplace — including anything out of stock. Go to Products to change what's listed here."
            emptyText="Nothing listed yet — add items from Products to appear here."
            basePath="/(reseller)"
          />
        )}
      </ScrollView>
    </View>
  );
}
