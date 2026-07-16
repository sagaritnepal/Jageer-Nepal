// lib/components/OrderCard.tsx
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseQuery, useSupabaseRow } from '../hooks/useSupabase';
import { useAdvanceOrder } from '../hooks/useAdvanceOrder';
import { NEXT_STATUS, STATUS_ACTION_LABEL, STATUS_BADGE_STYLE } from '../utils/orderStatus';
import type { Order, Product } from '../../types/database.types';

export function OrderCard({
  order,
  productMap,
  viewerId,
  basePath,
  roleLabel,
}: {
  order: Order;
  productMap: Map<string, Product>;
  viewerId: string;
  basePath: string;
  roleLabel?: string;
}) {
  const isOwner = order.seller_id === viewerId;
  const counterpartyId = order.buyer_id === viewerId ? order.seller_id : order.buyer_id;
  const counterpartyRole = order.buyer_id === viewerId ? 'Sold by' : 'Ordered by';
  const { data: counterparty } = useSupabaseRow('profiles', counterpartyId);
  const { data: orderItems } = useSupabaseQuery('order_items', {
    filters: { order_id: order.id },
  });

  const { advance, isBusy } = useAdvanceOrder();
  const nextStatus = NEXT_STATUS[order.status];
  const badgeClass = STATUS_BADGE_STYLE[order.status];

  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1">
          {roleLabel && (
            <Text className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{roleLabel}</Text>
          )}
          <Text className="text-xs text-gray-400">
            Order #{order.id.slice(0, 8)} · {counterpartyRole} {counterparty?.full_name ?? '…'}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${badgeClass}`}>
          <Text className={`text-xs font-semibold capitalize ${badgeClass}`}>{order.status}</Text>
        </View>
      </View>

      {orderItems?.map((item) => (
        <View key={item.id} className="mb-1 flex-row justify-between">
          <Text className="mr-2 flex-1 text-sm text-gray-700" numberOfLines={1}>
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

      <View className="mt-3 flex-row gap-2">
        {isOwner && nextStatus && (
          <Pressable
            onPress={() => advance(order, orderItems, productMap)}
            disabled={isBusy}
            className="flex-1 items-center rounded-lg bg-blue-700 py-2 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">
              {isBusy ? 'Updating…' : STATUS_ACTION_LABEL[order.status]}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push(`${basePath}/order/${order.id}`)}
          className="items-center rounded-lg border border-gray-300 px-4 py-2"
        >
          <Text className="text-sm font-semibold text-gray-700">Message</Text>
        </Pressable>
      </View>
    </View>
  );
}
