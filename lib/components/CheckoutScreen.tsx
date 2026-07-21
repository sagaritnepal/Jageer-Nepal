// lib/components/CheckoutScreen.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useCartStore } from '../hooks/useCart';
import { useSupabaseInsert } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';

const PLATFORM_FEE_RATE = 0.075;

export function CheckoutScreen({ redirectTo }: { redirectTo: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const items = useCartStore((state) => state.items);
  const sellerId = useCartStore((state) => state.sellerId);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const insertOrder = useSupabaseInsert('orders');
  const insertOrderItem = useSupabaseInsert('order_items');

  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
  const platformFee = Math.round(total * PLATFORM_FEE_RATE);
  const sellerPayout = total - platformFee;

  async function handlePlaceOrder() {
    if (!userId || !sellerId || items.length === 0) return;
    if (!address.trim() || !city.trim()) {
      showAlert('Shipping address required', 'Please fill in an address and city.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await insertOrder.mutateAsync({
        buyer_id: userId,
        seller_id: sellerId,
        total_amount: total,
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        payment_method: 'cash_on_delivery',
        shipping_address: { address: address.trim(), city: city.trim() },
        status: 'pending',
      });

      for (const item of items) {
        await insertOrderItem.mutateAsync({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        });
      }

      clearCart();
      showAlert('Order placed', 'The seller will confirm your order shortly.');
      router.replace(redirectTo as never);
    } catch (err) {
      showAlert('Could not place order', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-gray-500">Your cart is empty.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      {items.map((item) => (
        <View
          key={item.product.id}
          className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
        >
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">{item.product.name}</Text>
            <Text className="text-sm text-gray-500">NPR {Number(item.product.price).toLocaleString()} each</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => updateQuantity(item.product.id, item.quantity - 1)}>
              <Text className="text-lg text-gray-500">−</Text>
            </Pressable>
            <Text className="w-6 text-center font-semibold">{item.quantity}</Text>
            <Pressable onPress={() => updateQuantity(item.product.id, item.quantity + 1)}>
              <Text className="text-lg text-gray-500">+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View className="mb-4 mt-2 rounded-xl bg-white p-5">
        <Text className="mb-1 text-sm font-semibold text-gray-900">Shipping address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Street address"
          className="mb-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="City"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </View>

      <View className="mb-4 rounded-xl bg-white p-5">
        <View className="mb-1 flex-row justify-between">
          <Text className="text-sm text-gray-500">Total</Text>
          <Text className="text-sm font-semibold text-gray-900">NPR {total.toLocaleString()}</Text>
        </View>
        <Text className="text-xs text-gray-400">Payment: Cash on Delivery</Text>
      </View>

      <Pressable
        onPress={handlePlaceOrder}
        disabled={submitting}
        className="items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">{submitting ? 'Placing order…' : 'Place order'}</Text>
      </Pressable>
    </ScrollView>
  );
}
