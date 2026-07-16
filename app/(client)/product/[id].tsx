// app/(client)/product/[id].tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSupabaseRow, useSupabaseInsert } from '../../../lib/hooks/useSupabase';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useCartStore } from '../../../lib/hooks/useCart';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';

function RequestQuote({ productId, sellerId }: { productId: string; sellerId: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const insertQuote = useSupabaseInsert('product_quotes');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!userId) return;
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      showAlert('Invalid quantity', 'Enter a valid quantity.');
      return;
    }
    try {
      await insertQuote.mutateAsync({
        client_id: userId,
        reseller_id: sellerId,
        product_id: productId,
        quantity: qty,
        message: message.trim() || null,
      });
      setSent(true);
      showAlert('Quote requested', 'The seller will respond with a price soon — check My Quotes for updates.');
    } catch (err) {
      showAlert('Could not request quote', getErrorMessage(err));
    }
  }

  if (sent) {
    return (
      <Pressable
        onPress={() => router.push('/(client)/quotes')}
        className="mt-3 items-center rounded-xl border border-gray-300 py-3"
      >
        <Text className="text-sm font-semibold text-gray-700">View your quote request →</Text>
      </Pressable>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} className="mt-3 items-center rounded-xl border border-gray-300 py-3">
        <Text className="text-sm font-semibold text-gray-700">Request a custom quote</Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
      <Text className="mb-3 text-sm font-semibold text-gray-900">Request a quote</Text>
      <Text className="mb-1 text-xs font-medium text-gray-500">Quantity</Text>
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <Text className="mb-1 text-xs font-medium text-gray-500">Message (optional)</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="e.g. Best price for bulk order?"
        multiline
        className="mb-4 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <View className="flex-row gap-2">
        <Pressable onPress={() => setOpen(false)} className="flex-1 items-center rounded-lg border border-gray-300 py-2.5">
          <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSend}
          disabled={insertQuote.isPending}
          className="flex-1 items-center rounded-lg bg-blue-700 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">{insertQuote.isPending ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ClientProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading, isError } = useSupabaseRow('products', id);

  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-gray-500">This product isn't available.</Text>
      </View>
    );
  }

  if (isLoading || !product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const outOfStock = product.stock_level <= 0;

  function handleAddToCart() {
    const added = addToCart(product!);
    if (!added) {
      showAlert(
        'Cart has items from another seller',
        'Your cart can only hold products from one seller at a time. Clear it and add this item instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear cart',
            style: 'destructive',
            onPress: () => {
              clearCart();
              addToCart(product!);
              promptCheckout();
            },
          },
        ]
      );
      return;
    }
    promptCheckout();
  }

  function promptCheckout() {
    showAlert('Added to cart', 'What would you like to do next?', [
      { text: 'Keep browsing', style: 'cancel' },
      { text: 'Go to cart', onPress: () => router.push('/(client)/checkout') },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-6 pt-4">
        <View className="mb-4 aspect-square items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-5xl">🖥️</Text>
          )}
        </View>

        {product.category && (
          <Text className="text-xs font-bold uppercase tracking-wide text-blue-600">{product.category}</Text>
        )}
        <Text className="mt-1 text-xl font-extrabold text-gray-900">{product.name}</Text>
        <Text className="mt-2 text-2xl font-extrabold text-blue-700">
          NPR {Number(product.price).toLocaleString()}
        </Text>

        {product.description && (
          <Text className="mt-3.5 text-sm leading-6 text-gray-600">{product.description}</Text>
        )}

        <Text className="mt-4 text-xs text-gray-400">
          {outOfStock ? 'Out of stock' : `${product.stock_level} in stock`}
        </Text>
      </View>

      <View className="mt-6 px-6">
        <Pressable
          onPress={handleAddToCart}
          disabled={outOfStock}
          className="items-center rounded-xl bg-blue-700 py-3.5 disabled:opacity-40"
        >
          <Text className="text-base font-semibold text-white">
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </Text>
        </Pressable>

        <RequestQuote productId={product.id} sellerId={product.seller_id} />
      </View>
    </ScrollView>
  );
}
