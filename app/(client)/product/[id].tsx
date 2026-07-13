// app/(client)/product/[id].tsx
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSupabaseRow } from '../../../lib/hooks/useSupabase';
import { useCartStore } from '../../../lib/hooks/useCart';
import { showAlert } from '../../../lib/utils/alert';

export default function ClientProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading } = useSupabaseRow('products', id);

  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);

  if (isLoading || !product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const outOfStock = product.stock_level <= 0;

  function handleAddToCart() {
    const added = addToCart(product!);
    if (!added) {
      showAlert(
        'Cart has items from another seller',
        'Your cart can only hold products from one seller at a time. Clear it and add this item instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear cart',
            style: 'destructive',
            onPress: () => {
              clearCart();
              addToCart(product!);
              promptCheckout();
            },
          },
        ]
      );
      return;
    }
    promptCheckout();
  }

  function promptCheckout() {
    showAlert('Added to cart', 'What would you like to do next?', [
      { text: 'Keep browsing', style: 'cancel' },
      { text: 'Go to cart', onPress: () => router.push('/(client)/checkout') },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-6 pt-16">
        <View className="mb-4 aspect-square items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-5xl">🖥️</Text>
          )}
        </View>

        {product.category && (
          <Text className="text-xs font-bold uppercase tracking-wide text-blue-600">{product.category}</Text>
        )}
        <Text className="mt-1 text-xl font-extrabold text-gray-900">{product.name}</Text>
        <Text className="mt-2 text-2xl font-extrabold text-blue-700">
          NPR {Number(product.price).toLocaleString()}
        </Text>

        {product.description && (
          <Text className="mt-3.5 text-sm leading-6 text-gray-600">{product.description}</Text>
        )}

        <Text className="mt-4 text-xs text-gray-400">
          {outOfStock ? 'Out of stock' : `${product.stock_level} in stock`}
        </Text>
      </View>

      <View className="mt-6 px-6">
        <Pressable
          onPress={handleAddToCart}
          disabled={outOfStock}
          className="items-center rounded-xl bg-blue-700 py-3.5 disabled:opacity-40"
        >
          <Text className="text-base font-semibold text-white">
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
