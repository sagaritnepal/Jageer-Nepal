// lib/hooks/useAdvanceOrder.ts
import { useSupabaseUpdate } from './useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';
import { NEXT_STATUS } from '../utils/orderStatus';
import type { Order, OrderItem, Product } from '../../types/database.types';

/**
 * Shared seller-side "advance order status" action. Confirming an order is
 * the seller's commitment, so stock is decremented on the pending->confirmed
 * transition only - the seller owns the product rows and is the one allowed
 * to write to them.
 */
export function useAdvanceOrder() {
  const updateOrder = useSupabaseUpdate('orders');
  const updateProduct = useSupabaseUpdate('products');

  async function advance(order: Order, orderItems: OrderItem[] | undefined, productMap: Map<string, Product>) {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    try {
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
      showAlert('Could not update order', getErrorMessage(err));
    }
  }

  return { advance, isBusy: updateOrder.isPending || updateProduct.isPending };
}
