// lib/components/CartBar.tsx
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// A persistent bottom bar (not a modal) so a buyer can keep browsing and
// adding more items - item count, Checkout, and the cart total all update
// live underneath whatever they're doing, nothing to dismiss. Item count is
// the running total quantity across the cart, so it climbs the same way
// the total price does as more gets added.
export function CartBar({
  visible,
  itemCount,
  total,
  onCheckout,
}: {
  visible: boolean;
  itemCount: number;
  total: number;
  onCheckout: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between border-t border-gray-200 bg-white px-5 pt-3"
      style={{
        paddingBottom: insets.bottom + 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
        elevation: 10,
      }}
    >
      <View className="items-start">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In cart</Text>
        <Text className="text-base font-extrabold text-gray-900">{itemCount}</Text>
      </View>

      <Pressable onPress={onCheckout} className="items-center rounded-full bg-orange-500 px-7 py-3">
        <Text className="text-sm font-bold text-white">Checkout</Text>
      </Pressable>

      <View className="items-end">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total</Text>
        <Text className="text-base font-extrabold text-blue-700">NPR {total.toLocaleString()}</Text>
      </View>
    </View>
  );
}
