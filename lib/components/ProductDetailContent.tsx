// lib/components/ProductDetailContent.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { useSupabaseQuery, useSupabaseRow } from '../hooks/useSupabase';
import { toSafeImageUri } from '../utils/image';
import type { Product } from '../../types/database.types';

/** At or below this many in stock, the page says "Only N left". */
const LOW_STOCK = 5;

function stockStatus(stock: number) {
  if (stock <= 0) return { short: 'Out of stock', long: 'Out of stock', color: '#4B5563', bg: '#F3F4F6' };
  if (stock <= LOW_STOCK) return { short: `Only ${stock} left`, long: `Only ${stock} left`, color: '#B45309', bg: '#FFFBEB' };
  return { short: 'In stock', long: `In stock · ${stock} available`, color: '#15803D', bg: '#F0FDF4' };
}

function money(value: number): string {
  return `NPR ${Number(value).toLocaleString()}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** The body of a product page, shared by the client and reseller product screens.
 *
 * The price, how many are available, the quantity, the total and the button sit together in one
 * "buy box", so what a buyer needs to decide is in one place. Under it: what the seller wrote, the
 * product's details, and more from the same seller. On wide web the photo sits beside all of that,
 * so a full-width square photo never takes over the screen; on a phone it stacks. */
export function ProductDetailContent({
  product,
  onAddToCart,
  productPath,
}: {
  product: Product;
  /** Adds `quantity` of the product. Return false when it could not be added (the screen is asking
   * about the cart instead), so the button does not claim it was. */
  onAddToCart: (quantity: number) => boolean | void;
  /** Where a product page lives for this role, e.g. '/(client)/product' - for "More from this seller". */
  productPath: string;
}) {
  const wide = useIsWideWeb();
  const stock = Math.max(0, product.stock_level);
  const outOfStock = stock <= 0;
  const status = stockStatus(stock);
  const minOrder = Math.max(1, product.min_order_qty ?? 1);
  const startQty = Math.min(minOrder, Math.max(stock, 1));

  const [qty, setQty] = useState(startQty);
  const [added, setAdded] = useState(false);
  // A product screen is reused when another product is opened: begin again for the new one.
  useEffect(() => {
    setQty(startQty);
    setAdded(false);
  }, [product.id, startQty]);

  const { data: seller } = useSupabaseRow('profiles', product.seller_id);
  const sellerName = seller?.business_name?.trim() || seller?.full_name?.trim() || null;

  const { data: sellerProducts } = useSupabaseQuery('products', { filters: { seller_id: product.seller_id } });
  const related = useMemo(
    () =>
      (sellerProducts ?? [])
        .filter((p) => p.id !== product.id && p.stock_level > 0 && p.is_listed !== false && Number(p.price) > 0)
        .slice(0, 4),
    [sellerProducts, product.id]
  );

  const decDisabled = outOfStock || qty <= Math.min(minOrder, stock);
  const incDisabled = outOfStock || qty >= stock;
  const total = Number(product.price) * qty;

  function step(delta: number) {
    setAdded(false);
    setQty((q) => Math.min(Math.max(q + delta, Math.min(minOrder, Math.max(stock, 1))), Math.max(stock, 1)));
  }

  function handleAdd() {
    const result = onAddToCart(qty);
    if (result !== false) setAdded(true);
  }

  const image = (
    <View className="aspect-square items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-blue-50">
      {product.image_url ? (
        <Image source={{ uri: toSafeImageUri(product.image_url)! }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <Ionicons name="cube-outline" size={72} color="#93B4F5" />
      )}
      <View
        className="absolute left-3 top-3 flex-row items-center rounded-full px-3 py-1.5"
        style={{ backgroundColor: status.bg, gap: 6 }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
        <Text className="text-[12.5px] font-bold" style={{ color: status.color }}>
          {status.short}
        </Text>
      </View>
    </View>
  );

  const heading = (
    <View style={{ gap: 8 }}>
      {!!product.category && (
        <Text className="text-xs font-bold capitalize tracking-wide text-blue-600">{product.category}</Text>
      )}
      <Text className={wide ? 'text-[30px] font-extrabold leading-9 text-gray-900' : 'text-2xl font-extrabold leading-8 text-gray-900'}>
        {product.name}
      </Text>
      {!!sellerName && (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-blue-100">
            <Text className="text-[11px] font-bold text-blue-700">{initialsOf(sellerName)}</Text>
          </View>
          <Text className="flex-shrink text-[13.5px] text-gray-600" numberOfLines={1}>
            Sold by <Text className="font-bold text-gray-900">{sellerName}</Text>
          </Text>
        </View>
      )}
    </View>
  );

  const buyBox = (
    <View className="rounded-2xl border border-gray-200 bg-white p-5" style={{ gap: 18 }}>
      <View className="flex-row flex-wrap items-baseline" style={{ gap: 10 }}>
        <Text className={`text-4xl font-extrabold ${outOfStock ? 'text-gray-500' : 'text-blue-700'}`}>
          {money(product.price)}
        </Text>
        <Text className="text-[13.5px] text-gray-500">per unit</Text>
      </View>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: status.bg }}>
          <Text className="text-[13px] font-bold" style={{ color: status.color }}>
            {status.long}
          </Text>
        </View>
        <View className="rounded-full bg-gray-100 px-3 py-1.5">
          <Text className="text-[13px] font-semibold text-gray-700">Minimum order: {minOrder}</Text>
        </View>
      </View>

      <View className="h-px bg-gray-200" />

      <View className="flex-row flex-wrap items-center justify-between" style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text className="text-[12.5px] font-semibold text-gray-500">Quantity</Text>
          <View className="flex-row items-center rounded-xl border border-gray-300 bg-white">
            <Pressable
              onPress={() => step(-1)}
              disabled={decDisabled}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              className="h-12 w-12 items-center justify-center"
              style={{ opacity: decDisabled ? 0.35 : 1 }}
            >
              <Ionicons name="remove" size={22} color="#374151" />
            </Pressable>
            <Text className="min-w-[44px] text-center text-[17px] font-bold text-gray-900">{outOfStock ? 0 : qty}</Text>
            <Pressable
              onPress={() => step(1)}
              disabled={incDisabled}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              className="h-12 w-12 items-center justify-center"
              style={{ opacity: incDisabled ? 0.35 : 1 }}
            >
              <Ionicons name="add" size={22} color="#374151" />
            </Pressable>
          </View>
        </View>
        <View className="items-end" style={{ gap: 2 }}>
          <Text className="text-[12.5px] font-semibold text-gray-500">Total</Text>
          <Text className={`text-[22px] font-extrabold ${outOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
            {money(outOfStock ? 0 : total)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleAdd}
        disabled={outOfStock}
        accessibilityRole="button"
        className="h-[54px] items-center justify-center rounded-2xl"
        style={{ backgroundColor: outOfStock ? '#9CA3AF' : added ? '#15803D' : '#EA580C' }}
      >
        <Text className="text-[16.5px] font-bold text-white">
          {outOfStock ? 'Out of stock' : added ? `Added ${qty} to cart` : 'Add to cart'}
        </Text>
      </Pressable>

      <Text className="text-[12.5px] leading-[18px] text-gray-500">
        Your cart holds items from one seller at a time. Adding this item to a cart that has another seller&apos;s items
        will ask you to clear it first.
      </Text>
    </View>
  );

  const about = !!product.description?.trim() && (
    <View className="rounded-2xl border border-gray-200 bg-white p-5" style={{ gap: 10 }}>
      <Text className="text-[17px] font-extrabold text-gray-900">About this product</Text>
      <Text className="text-[14.5px] leading-[24px] text-gray-600">{product.description}</Text>
    </View>
  );

  const detailRows: [string, string][] = [
    ...(product.category ? ([['Category', product.category]] as [string, string][]) : []),
    ['Availability', status.short],
    ['Minimum order', `${minOrder} ${minOrder === 1 ? 'unit' : 'units'}`],
    ...(sellerName ? ([['Sold by', sellerName]] as [string, string][]) : []),
  ];
  const details = (
    <View className="rounded-2xl border border-gray-200 bg-white p-5" style={{ gap: 12 }}>
      <Text className="text-[17px] font-extrabold text-gray-900">Details</Text>
      {detailRows.map(([label, value]) => (
        <View key={label} className="flex-row justify-between" style={{ gap: 18 }}>
          <Text className="text-sm text-gray-500">{label}</Text>
          <Text className="flex-1 text-right text-sm font-semibold text-gray-900">{value}</Text>
        </View>
      ))}
    </View>
  );

  const relatedCard = (item: Product, width?: number) => {
    const itemStatus = stockStatus(item.stock_level);
    return (
      <Pressable
        key={item.id}
        onPress={() => router.push(`${productPath}/${item.id}` as never)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
        style={width ? { width } : { flex: 1, maxWidth: 260, minWidth: 0 }}
      >
        {/* An explicit ratio: an arbitrary `aspect-[4/3]` class is not applied, which left this box with
            no height and the picture invisible. */}
        <View className="items-center justify-center overflow-hidden bg-blue-50" style={{ width: '100%', aspectRatio: 4 / 3 }}>
          {item.image_url ? (
            <Image
              source={{ uri: toSafeImageUri(item.image_url)! }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="cube-outline" size={34} color="#93B4F5" />
          )}
        </View>
        <View className="px-3 pb-3.5 pt-3" style={{ gap: 3 }}>
          <Text className="text-[13.5px] font-bold text-gray-900" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-sm font-extrabold text-blue-700">{money(item.price)}</Text>
          <Text className="text-xs font-semibold" style={{ color: itemStatus.color }}>
            {itemStatus.short}
          </Text>
        </View>
      </Pressable>
    );
  };

  const moreFromSeller = related.length > 0 && (
    <View style={{ gap: 14 }}>
      <Text className="text-lg font-extrabold text-gray-900" numberOfLines={1}>
        {sellerName ? `More from ${sellerName}` : 'More from this seller'}
      </Text>
      {wide ? (
        <View className="flex-row" style={{ gap: 16 }}>
          {related.map((item) => relatedCard(item))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {related.map((item) => relatedCard(item, 150))}
        </ScrollView>
      )}
    </View>
  );

  if (wide) {
    return (
      <View style={{ gap: 28, padding: 32, paddingTop: 24, width: '100%', maxWidth: 1120 }}>
        <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : undefined)} hitSlop={6}>
            <Text className="text-[13px] font-semibold text-blue-600">Shop</Text>
          </Pressable>
          {!!product.category && (
            <>
              <Text className="text-[13px] text-gray-400">/</Text>
              <Text className="text-[13px] font-semibold text-gray-500">{product.category}</Text>
            </>
          )}
          <Text className="text-[13px] text-gray-400">/</Text>
          <Text className="text-[13px] font-semibold text-gray-900" numberOfLines={1}>
            {product.name}
          </Text>
        </View>

        <View className="flex-row items-start" style={{ gap: 32 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, maxWidth: 520, minWidth: 0 }}>{image}</View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0, gap: 20 }}>
            {heading}
            {buyBox}
          </View>
        </View>

        <View className="flex-row items-start" style={{ gap: 20 }}>
          {about ? <View style={{ flex: 2, minWidth: 0 }}>{about}</View> : null}
          <View style={{ flex: 1, minWidth: 0 }}>{details}</View>
        </View>

        {moreFromSeller}
      </View>
    );
  }

  return (
    <View className="px-4 pt-4" style={{ gap: 18 }}>
      {image}
      {heading}
      {buyBox}
      {about}
      {details}
      {moreFromSeller}
    </View>
  );
}
