// lib/components/AddedToCartSheet.tsx
import { Modal, Pressable, Text, View } from 'react-native';

// Shown right after "Add to cart" - a quick, three-part strip (stock left,
// Checkout in the middle, cart total) so a buyer can jump straight to
// checkout without losing sight of what's left in stock or what it'll cost.
export function AddedToCartSheet({
  visible,
  productName,
  stockLeft,
  total,
  onCheckout,
  onClose,
}: {
  visible: boolean;
  productName: string;
  stockLeft: number;
  total: number;
  onCheckout: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="rounded-t-3xl bg-white px-6 pt-3 pb-10" onPress={() => {}}>
          <View className="items-center">
            <View className="h-1 w-10 rounded-full bg-gray-200" />
          </View>

          <Text className="mt-4 text-center text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Added to cart
          </Text>
          <Text className="mb-5 mt-0.5 text-center text-base font-bold text-gray-900" numberOfLines={1}>
            {productName}
          </Text>

          <View className="flex-row items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <View className="items-start">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In stock</Text>
              <Text className="mt-1 text-lg font-extrabold text-gray-900">{stockLeft}</Text>
            </View>

            <Pressable
              onPress={onCheckout}
              className="items-center rounded-full bg-orange-500 px-6 py-3.5"
              style={{ shadowColor: '#EA580C', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
            >
              <Text className="text-sm font-bold text-white">Checkout</Text>
            </Pressable>

            <View className="items-end">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total</Text>
              <Text className="mt-1 text-lg font-extrabold text-blue-700">NPR {total.toLocaleString()}</Text>
            </View>
          </View>

          <Pressable onPress={onClose} className="mt-4 items-center py-2">
            <Text className="text-sm font-semibold text-gray-500">Keep browsing</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
