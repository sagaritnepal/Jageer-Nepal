// lib/components/CheckoutScreen.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuthStore } from '../hooks/useAuth';
import { useCartStore } from '../hooks/useCart';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { useSupabaseRow } from '../hooks/useSupabase';
import { toSafeImageUri } from '../utils/image';
import { showAlert, getErrorMessage } from '../utils/alert';

// Sizes and spacing are set inline (as on the product page), so they always apply.
const INK = '#111827';
const MUTED = '#6B7280';
const SOFT = '#4B5563';
const LINE = '#E5E7EB';
const BLUE = '#1D4ED8';

const text = (size: number, weight: TextStyle['fontWeight'], color: string, extra?: TextStyle): TextStyle => ({
  fontSize: size,
  fontWeight: weight,
  color,
  ...extra,
});

const card = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: LINE,
  borderRadius: 16,
} as const;

function money(value: number): string {
  return `NPR ${Number(value).toLocaleString()}`;
}

/** The order a buyer is about to place: what is in the cart (with each line's total and a way to
 * change or remove it), where it goes, and the total. `redirectTo` is where they land once it is
 * placed; `shopPath` is where "Continue shopping" goes. */
export function CheckoutScreen({ redirectTo, shopPath }: { redirectTo: string; shopPath: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const items = useCartStore((state) => state.items);
  const sellerId = useCartStore((state) => state.sellerId);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const wide = useIsWideWeb();

  const queryClient = useQueryClient();
  const { data: seller } = useSupabaseRow('profiles', sellerId ?? undefined);
  const sellerName = seller?.business_name?.trim() || seller?.full_name?.trim() || null;

  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
  const unitCount = items.reduce((sum, i) => sum + i.quantity, 0);

  async function handlePlaceOrder() {
    if (!userId || !sellerId || items.length === 0) return;
    if (!address.trim() || !city.trim()) {
      showAlert('Shipping address required', 'Please fill in an address and city.');
      return;
    }

    setSubmitting(true);
    try {
      // One server-side transaction (migration 0078): the order and all its
      // lines are saved together or not at all, so a failure can never
      // leave a half-filled order behind for a retry to duplicate.
      const { error } = await (supabase as any).rpc('place_order', {
        p_seller_id: sellerId,
        p_items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        p_shipping: { address: address.trim(), city: city.trim() },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });

      clearCart();
      showAlert('Order placed', 'The seller will confirm your order shortly.');
      router.replace(redirectTo as never);
    } catch (err) {
      showAlert('Could not place order', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 24, gap: 14 }}>
        <Ionicons name="cart-outline" size={44} color="#9CA3AF" />
        <Text style={text(16, '700', INK)}>Your cart is empty</Text>
        <Text style={text(13.5, '400', MUTED, { textAlign: 'center' })}>Add something from the shop and it will show up here.</Text>
        <Pressable
          onPress={() => router.replace(shopPath as never)}
          accessibilityRole="button"
          style={{ height: 48, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={text(15, '700', '#FFFFFF')}>Continue shopping</Text>
        </Pressable>
      </View>
    );
  }

  // The cart: one card per line, with the picture, the numbers, a stepper, the line total and a remove.
  const cartLines = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text style={text(18, '800', INK)}>
          Your order · {items.length} {items.length === 1 ? 'item' : 'items'}
        </Text>
        {!!sellerName && (
          <Text style={[text(13.5, '400', SOFT), { flexShrink: 1 }]} numberOfLines={1}>
            Sold by <Text style={text(13.5, '700', INK)}>{sellerName}</Text>
          </Text>
        )}
      </View>

      {items.map((item) => {
        const minOrder = Math.max(1, item.product.min_order_qty ?? 1);
        const stock = Math.max(0, item.product.stock_level);
        const decDisabled = item.quantity <= minOrder;
        const incDisabled = item.quantity >= stock;
        return (
          <View key={item.product.id} style={{ ...card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#EAF1FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.product.image_url ? (
                <Image
                  source={{ uri: toSafeImageUri(item.product.image_url)! }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="cube-outline" size={28} color="#93B4F5" />
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={text(15, '700', INK)} numberOfLines={2}>
                {item.product.name}
              </Text>
              <Text style={text(13, '400', SOFT)}>{money(item.product.price)} each</Text>
              <Text style={text(12, '400', '#9CA3AF')}>
                {minOrder > 1 ? `Min ${minOrder} · ` : ''}
                {stock} in stock
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 10 }}>
              <Text style={text(16, '800', INK)}>{money(Number(item.product.price) * item.quantity)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Pressable
                    onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                    disabled={decDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${item.product.name}`}
                    style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', opacity: decDisabled ? 0.35 : 1 }}
                  >
                    <Ionicons name="remove" size={18} color="#374151" />
                  </Pressable>
                  <Text style={text(15, '700', INK, { minWidth: 30, textAlign: 'center' })}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                    disabled={incDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${item.product.name}`}
                    style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', opacity: incDisabled ? 0.35 : 1 }}
                  >
                    <Ionicons name="add" size={18} color="#374151" />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => removeItem(item.product.id)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.product.name}`}
                  style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}
                >
                  <Ionicons name="trash-outline" size={19} color="#DC2626" />
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => router.replace(shopPath as never)} hitSlop={6} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Text style={text(13.5, '700', '#2563EB')}>+ Add more from the shop</Text>
      </Pressable>
    </View>
  );

  const inputStyle = {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: INK,
    backgroundColor: '#FFFFFF',
  } as const;

  const orderSummary = (
    <View style={{ gap: 16 }}>
      <View style={{ ...card, padding: 20, gap: 14 }}>
        <Text style={text(17, '800', INK)}>Delivery</Text>
        <View style={{ gap: 6 }}>
          <Text style={text(12.5, '600', MUTED)}>Street address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="House no., street, area"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={text(12.5, '600', MUTED)}>City</Text>
          <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#9CA3AF" style={inputStyle} />
        </View>
      </View>

      <View style={{ ...card, padding: 20, gap: 14 }}>
        <Text style={text(17, '800', INK)}>Summary</Text>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={text(14, '400', MUTED)}>
              {unitCount} {unitCount === 1 ? 'unit' : 'units'}
            </Text>
            <Text style={text(14, '600', INK)}>{money(total)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={text(14, '400', MUTED)}>Payment</Text>
            <Text style={text(14, '600', INK)}>Cash on delivery</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: LINE }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <Text style={text(15, '700', INK)}>Total</Text>
          <Text style={text(24, '800', BLUE)}>{money(total)}</Text>
        </View>

        <Pressable
          onPress={handlePlaceOrder}
          disabled={submitting}
          accessibilityRole="button"
          style={{
            height: 54,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EA580C',
            opacity: submitting ? 0.5 : 1,
          }}
        >
          <Text style={text(16.5, '700', '#FFFFFF')}>{submitting ? 'Placing order…' : 'Place order'}</Text>
        </Pressable>

        <Text style={text(12.5, '400', MUTED, { lineHeight: 19 })}>
          The seller confirms your order, then you pay when it is delivered.
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View
        style={{
          width: '100%',
          maxWidth: 1400,
          alignSelf: 'center',
          paddingHorizontal: wide ? 32 : 16,
          paddingTop: wide ? 24 : 16,
          gap: 20,
        }}
      >
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
            <View style={{ flex: 3, minWidth: 0 }}>{cartLines}</View>
            <View style={{ flex: 2, minWidth: 0 }}>{orderSummary}</View>
          </View>
        ) : (
          <>
            {cartLines}
            {orderSummary}
          </>
        )}
      </View>
    </ScrollView>
  );
}
