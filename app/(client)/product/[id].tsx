// app/(client)/product/[id].tsx
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';
import { useSupabaseRow } from '../../../lib/hooks/useSupabase';
import { useCartStore } from '../../../lib/hooks/useCart';
import { CartBar } from '../../../lib/components/CartBar';
import { ProductDetailContent } from '../../../lib/components/ProductDetailContent';
import { showAlert } from '../../../lib/utils/alert';

export default function ClientProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading, isError } = useSupabaseRow('products', id);

  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartItems = useCartStore((state) => state.items);
  const cartTotal = cartItems.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-gray-500">This product isn't available.</Text>
      </View>
    );
  }

  if (isLoading || !product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

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
            },
          },
        ]
      );
      return;
    }
  }

  return (
    <View className="flex-1">
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: cartCount > 0 ? 100 : 40 }}>
      <ProductDetailContent product={product} onAddToCart={handleAddToCart} />
      </ScrollView>

      <CartBar
        visible={cartCount > 0}
        itemCount={cartCount}
        total={cartTotal}
        onCheckout={() => router.push('/(client)/checkout')}
      />
    </View>
  );
}
