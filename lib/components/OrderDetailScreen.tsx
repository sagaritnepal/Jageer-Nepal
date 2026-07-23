// lib/components/OrderDetailScreen.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery } from '../hooks/useSupabase';
import { useAdvanceOrder } from '../hooks/useAdvanceOrder';
import { ChatThread } from './ChatThread';
import { PersonAvatar } from './PersonAvatar';
import { NEXT_STATUS, STATUS_ACTION_LABEL } from '../utils/orderStatus';

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: order, isLoading } = useSupabaseRow('orders', id);
  const { data: orderItems } = useSupabaseQuery('order_items', {
    filters: id ? { order_id: id } : {},
    enabled: !!id,
  });
  const { data: products } = useSupabaseQuery('products', {});

  const counterpartyId = order && order.buyer_id === userId ? order.seller_id : order?.buyer_id;
  const counterpartyRole = order?.buyer_id === userId ? 'Sold by' : 'Ordered by';
  const { data: counterparty } = useSupabaseRow('profiles', counterpartyId);

  const { advance, isBusy } = useAdvanceOrder();

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

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</Text>

      <View className="mb-6 flex-row items-center gap-3">
        <PersonAvatar name={counterparty?.full_name} photoUrl={counterparty?.avatar_url} size={40} />
        <View>
          <Text className="text-[11px] uppercase tracking-wide text-gray-400">{counterpartyRole}</Text>
          <Text className="text-sm font-semibold text-gray-800">{counterparty?.full_name ?? 'Unknown'}</Text>
          {counterparty?.phone && <Text className="text-xs text-gray-500">{counterparty.phone}</Text>}
        </View>
      </View>

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
          onPress={() => advance(order, orderItems, productMap)}
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
