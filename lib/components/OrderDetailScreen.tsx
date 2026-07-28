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
import type { OrderStatus } from '../../types/database.types';

const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Order placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'delivered', label: 'Delivered' },
];

function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <View className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
        <Text className="text-sm font-semibold text-red-700">This order was cancelled.</Text>
      </View>
    );
  }

  const currentIndex = ORDER_STEPS.findIndex((s) => s.status === status);

  return (
    <View className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      {ORDER_STEPS.map((step, i) => {
        const done = i < currentIndex || (i === currentIndex && status === 'delivered');
        const active = i === currentIndex && status !== 'delivered';
        return (
          <View
            key={step.status}
            className="flex-row items-center gap-3"
            style={{ paddingBottom: i < ORDER_STEPS.length - 1 ? 14 : 0 }}
          >
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: done ? '#059669' : active ? '#3b82f6' : '#E2E8F0' }}
            />
            <Text className={`text-[12.5px] ${done || active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

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

  // Same privacy rule as the order card in the list: photo, name, and
  // delivery address are always visible, but the contact number stays
  // hidden until the order has actually been accepted (confirmed onward).
  const isAccepted = order.status !== 'pending';
  const shipping = order.shipping_address as { address?: string; city?: string } | null;
  const shippingAddress = shipping ? [shipping.address, shipping.city].filter(Boolean).join(', ') : null;

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</Text>

      <OrderStatusStepper status={order.status} />

      <View className="mb-6 flex-row items-center gap-3">
        <PersonAvatar name={counterparty?.full_name} photoUrl={counterparty?.avatar_url} size={40} />
        <View>
          <Text className="text-[11px] uppercase tracking-wide text-gray-400">{counterpartyRole}</Text>
          <Text className="text-sm font-semibold text-gray-800">{counterparty?.full_name ?? 'Unknown'}</Text>
          {shippingAddress && <Text className="text-xs text-gray-500">{shippingAddress}</Text>}
          {isAccepted && counterparty?.phone && <Text className="text-xs text-gray-500">{counterparty.phone}</Text>}
        </View>
      </View>

      <View className="mb-6 rounded-xl bg-white p-5">
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

      {isOwner && nextStatus && (
        <Pressable
          onPress={() => advance(order, orderItems, productMap)}
          disabled={isBusy}
          className="mb-4 items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
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
