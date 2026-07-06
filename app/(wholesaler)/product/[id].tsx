// app/(wholesaler)/product/[id].tsx
import { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseInsert } from '../../../lib/hooks/useSupabase';

const PLATFORM_FEE_RATE = 0.075;

export default function WholesaleProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: product, isLoading } = useSupabaseRow('products', id);

  const insertOrder = useSupabaseInsert('orders');
  const insertOrderItem = useSupabaseInsert('order_items');

  const [quantity, setQuantity] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading || !product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const qty = quantity ?? product.min_order_qty;
  const unitPrice = Number(product.wholesale_price ?? product.price);
  const total = unitPrice * qty;
  const platformFee = Math.round(total * PLATFORM_FEE_RATE);

  async function handleRequestOrder() {
    if (!userId) return;
    if (qty < product!.min_order_qty) {
      Alert.alert('Below minimum order', `This listing requires at least ${product!.min_order_qty} units.`);
      return;
    }
    if (qty > product!.stock_level) {
      Alert.alert('Not enough stock', `Only ${product!.stock_level} units are available.`);
      return;
    }

    setSubmitting(true);
    try {
      const order = await insertOrder.mutateAsync({
        buyer_id: userId,
        seller_id: product!.seller_id,
        total_amount: total,
        platform_fee: platformFee,
        seller_payout: total - platformFee,
        payment_method: 'wholesale_order',
        status: 'pending',
      });
      await insertOrderItem.mutateAsync({
        order_id: order.id,
        product_id: product!.id,
        quantity: qty,
        unit_price: unitPrice,
      });
      Alert.alert('Bulk order requested', 'The seller will confirm your order shortly.');
      router.replace('/(wholesaler)/orders');
    } catch (err) {
      Alert.alert('Could not place order', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{product.name}</Text>
      <Text className="mb-6 text-sm text-gray-500">Minimum order quantity: {product.min_order_qty} units</Text>

      <View className="mb-4 rounded-xl bg-white p-5">
        <View className="mb-1 flex-row justify-between">
          <Text className="text-sm text-gray-500">Unit price</Text>
          <Text className="text-sm font-semibold text-gray-900">NPR {unitPrice.toLocaleString()}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-500">Available stock</Text>
          <Text className="text-sm font-semibold text-gray-900">{product.stock_level} units</Text>
        </View>
      </View>

      <Text className="mb-2 text-sm font-semibold text-gray-900">Quantity</Text>
      <View className="mb-4 flex-row items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <Pressable onPress={() => setQuantity(Math.max(product.min_order_qty, qty - product.min_order_qty))}>
          <Text className="text-xl text-gray-500">−</Text>
        </Pressable>
        <Text className="flex-1 text-center text-base font-semibold text-gray-900">{qty}</Text>
        <Pressable onPress={() => setQuantity(qty + product.min_order_qty)}>
          <Text className="text-xl text-gray-500">+</Text>
        </Pressable>
      </View>

      <View className="mb-6 flex-row items-center gap-2.5 rounded-xl bg-[#F1E9FE] px-4 py-3.5">
        <Text className="text-xs font-semibold text-[#5B21B6]">Escrow protection available on this order</Text>
      </View>

      <View className="mb-4 rounded-xl bg-white p-5">
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-500">Total</Text>
          <Text className="text-base font-bold text-[#7C3AED]">NPR {total.toLocaleString()}</Text>
        </View>
      </View>

      <Pressable
        onPress={handleRequestOrder}
        disabled={submitting}
        className="items-center rounded-xl bg-[#7C3AED] py-3.5 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {submitting ? 'Requesting…' : 'Request Bulk Order'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
