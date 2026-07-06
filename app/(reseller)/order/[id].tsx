// app/(reseller)/order/[id].tsx
import { useMemo } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';
import { ChatThread } from '../../../lib/components/ChatThread';
import type { OrderStatus } from '../../../types/database.types';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

const STATUS_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirm order',
  confirmed: 'Mark shipped',
  shipped: 'Mark delivered',
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: order, isLoading } = useSupabaseRow('orders', id);
  const { data: orderItems } = useSupabaseQuery('order_items', {
    filters: id ? { order_id: id } : {},
    enabled: !!id,
  });
  const { data: products } = useSupabaseQuery('products', {});
  const { data: buyer } = useSupabaseRow('profiles', order?.buyer_id);

  const updateOrder = useSupabaseUpdate('orders');
  const updateProduct = useSupabaseUpdate('products');

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  if (isLoading || !order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];
  const isOwner = order.seller_id === userId;

  async function handleAdvance() {
    if (!nextStatus || !order) return;
    try {
      // Confirming is the seller's commitment, so stock is decremented here -
      // the seller owns the product rows and is the one allowed to write to them.
      if (order.status === 'pending' && orderItems) {
        for (const item of orderItems) {
          const product = productMap.get(item.product_id);
          if (!product) continue;
          await updateProduct.mutateAsync({
            id: product.id,
            values: { stock_level: Math.max(0, product.stock_level - item.quantity) },
          });
        }
      }
      await updateOrder.mutateAsync({ id: order.id, values: { status: nextStatus } });
    } catch (err) {
      Alert.alert('Could not update order', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  const isBusy = updateOrder.isPending || updateProduct.isPending;

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</Text>
      <Text className="mb-6 text-gray-500">Buyer: {buyer?.full_name ?? 'Unknown'}</Text>

      <View className="mb-4 rounded-xl bg-white p-5">
        {orderItems?.map((item) => (
          <View key={item.id} className="mb-1 flex-row justify-between">
            <Text className="text-sm text-gray-700">
              {productMap.get(item.product_id)?.name ?? 'Product'} × {item.quantity}
            </Text>
            <Text className="text-sm text-gray-700">
              NPR {(Number(item.unit_price) * item.quantity).toLocaleString()}
            </Text>
          </View>
        ))}
        <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-2">
          <Text className="font-semibold text-gray-900">Total</Text>
          <Text className="font-semibold text-gray-900">NPR {Number(order.total_amount).toLocaleString()}</Text>
        </View>
      </View>

      <View className="mb-6 rounded-xl bg-white p-5">
        <Text className="text-sm uppercase tracking-wide text-gray-400">Status</Text>
        <Text className="mt-1 text-lg font-semibold capitalize text-blue-700">{order.status}</Text>
      </View>

      {isOwner && nextStatus && (
        <Pressable
          onPress={handleAdvance}
          disabled={isBusy}
          className="mb-4 items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-white">
            {isBusy ? 'Updating…' : STATUS_ACTION_LABEL[order.status]}
          </Text>
        </Pressable>
      )}

      <ChatThread subjectType="order" subjectId={order.id} />
    </ScrollView>
  );
}
