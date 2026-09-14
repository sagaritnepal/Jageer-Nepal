// lib/components/OrderDetailScreen.tsx
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery } from '../hooks/useSupabase';
import { useAdvanceOrder } from '../hooks/useAdvanceOrder';
import { ChatThread } from './ChatThread';
import {
  DetailShell,
  DetailHero,
  DetailCard,
  DetailTimeline,
  NextStepCard,
  DetailButton,
  PersonRow,
  initialsOf,
  useWideDetail,
  type TimelineStep,
} from './detail/DetailLayout';
import { NEXT_STATUS, STATUS_ACTION_LABEL } from '../utils/orderStatus';
import type { OrderStatus } from '../../types/database.types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function orderSteps(status: OrderStatus, isOwner: boolean): TimelineStep[] {
  const order: OrderStatus[] = ['pending', 'confirmed', 'delivered'];
  const currentIndex = order.indexOf(status === 'shipped' ? 'confirmed' : status);
  const meta = [
    null,
    isOwner ? 'You confirm and pack it' : 'The seller confirms it',
    isOwner ? 'Mark delivered when handed over' : 'Handed over to you',
  ];
  return order.map((step, index) => ({
    label: STATUS_LABEL[step],
    meta: index === currentIndex && status !== 'delivered' ? meta[index] : null,
    done: index < currentIndex || status === 'delivered',
    now: index === currentIndex && status !== 'delivered',
  }));
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useWideDetail();

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
  const nextLabel = STATUS_ACTION_LABEL[order.status];
  const isOwner = order.seller_id === userId;
  const canAdvance = isOwner && !!nextStatus && !!nextLabel;

  // Same privacy rule as the order card in the list: photo, name, and
  // delivery address are always visible, but the contact number stays
  // hidden until the order has actually been accepted (confirmed onward).
  const isAccepted = order.status !== 'pending';
  const shipping = order.shipping_address as { address?: string; city?: string } | null;
  const shippingAddress = shipping ? [shipping.address, shipping.city].filter(Boolean).join(', ') : null;
  const itemCount = orderItems?.length ?? 0;
  const total = `NPR ${Number(order.total_amount).toLocaleString()}`;
  const tone = order.status === 'cancelled' ? 'gray' : order.status === 'delivered' ? 'green' : 'emerald';

  const advanceButton = canAdvance ? (
    <DetailButton
      label={isBusy ? 'Updating…' : nextLabel}
      icon="checkmark-circle"
      kind="green"
      disabled={isBusy}
      onPress={() => advance(order, orderItems, productMap)}
    />
  ) : null;

  const rightColumn = (
    <>
      {canAdvance && (
        <NextStepCard
          wide={wide}
          title={order.status === 'pending' ? 'Confirm this order' : 'Hand it over'}
          hint={
            order.status === 'pending'
              ? 'Confirming shares your number with the customer and moves it to My Jobs.'
              : 'Mark it delivered once the customer has the items.'
          }
        >
          {advanceButton}
        </NextStepCard>
      )}

      <DetailCard wide={wide} icon="time-outline" title="Progress">
        {order.status === 'cancelled' ? (
          <Text className="text-sm font-semibold text-red-600">This order was cancelled.</Text>
        ) : (
          <DetailTimeline steps={orderSteps(order.status, isOwner)} />
        )}
      </DetailCard>
    </>
  );

  return (
    <DetailShell
      right={rightColumn}
      bottomBar={
        canAdvance ? (
          <>
            <View className="flex-1">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Next step</Text>
              <Text className="text-[13.5px] font-bold text-gray-900">{nextLabel}</Text>
            </View>
            <View style={{ minWidth: 168 }}>{advanceButton}</View>
          </>
        ) : null
      }
    >
      <DetailHero
        wide={wide}
        tone={tone}
        icon={
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: wide ? 62 : 52, height: wide ? 62 : 52, backgroundColor: 'rgba(255,255,255,0.18)' }}
          >
            <Ionicons name="gift" size={wide ? 30 : 26} color="#fff" />
          </View>
        }
        title={`Order #${order.id.slice(0, 8)}`}
        pill={STATUS_LABEL[order.status]}
        subtitle={`${itemCount} item${itemCount === 1 ? '' : 's'} · ${counterpartyRole} ${counterparty?.full_name ?? '…'}`}
        amountLabel="Order total"
        amount={total}
        facts={[
          { icon: 'person-outline', label: counterpartyRole, value: counterparty?.full_name ?? '…' },
          ...(shippingAddress
            ? ([{ icon: 'location-outline', label: 'Deliver to', value: shippingAddress }] as const)
            : []),
        ]}
      />

      <DetailCard
        wide={wide}
        icon="bag-outline"
        title="Items"
        right={<Text className="text-xs text-gray-500">{itemCount} item{itemCount === 1 ? '' : 's'}</Text>}
      >
        <View style={{ gap: 10 }}>
          {orderItems?.map((item) => (
            <View key={item.id} className="flex-row items-center gap-3 rounded-xl border border-gray-100 p-3">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <Ionicons name="cube-outline" size={22} color="#9CA3AF" />
              </View>
              <View className="flex-1" style={{ gap: 2 }}>
                <Text className="text-[15px] font-semibold text-gray-900">
                  {productMap.get(item.product_id)?.name ?? 'Product'}
                </Text>
                <Text className="text-[12.5px] text-gray-400">
                  Qty {item.quantity} · NPR {Number(item.unit_price).toLocaleString()} each
                </Text>
              </View>
              <Text className="text-[15px] font-bold text-gray-900">
                NPR {(Number(item.unit_price) * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
        <View className="mt-3.5 flex-row items-baseline justify-between border-t border-gray-100 pt-3.5">
          <Text className="text-[15px] font-bold text-gray-900">Total</Text>
          <Text className="text-xl font-extrabold text-gray-900">{total}</Text>
        </View>
      </DetailCard>

      <DetailCard wide={wide} icon="person-outline" title={counterpartyRole}>
        <PersonRow
          name={counterparty?.full_name ?? 'Unknown'}
          sub={isAccepted && counterparty?.phone ? counterparty.phone : shippingAddress}
          initials={initialsOf(counterparty?.full_name)}
        />
        {!isAccepted && (
          <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5">
            <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />
            <Text className="flex-1 text-[12.5px] text-gray-400">
              Phone number unlocks once you confirm this order.
            </Text>
          </View>
        )}
      </DetailCard>

      <DetailCard wide={wide} icon="chatbubble-outline" title="Messages">
        <ChatThread subjectType="order" subjectId={order.id} />
      </DetailCard>
    </DetailShell>
  );
}
