// lib/components/ProductDetailContent.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { useSupabaseQuery, useSupabaseRow } from '../hooks/useSupabase';
import { toSafeImageUri } from '../utils/image';
import type { Product } from '../../types/database.types';

/** At or below this many in stock, the page says "Only N left". */
const LOW_STOCK = 5;

// The sizes and spacing of this page are set inline, not as utility classes: a class name the style
// compiler has not seen yet is silently ignored by a running app (the price came out small and the
// button thin), while an inline value always applies. The numbers are the canvas design's.
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

/** A button that changes a little under the mouse pointer (web). For leaf buttons like these; a card
 * with buttons inside it uses its own mouse events instead (see RelatedCard), because a Pressable
 * inside swallows the outer one's hover. */
function HoverPressable({
  hoverStyle,
  style,
  disabled,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: ViewStyle; hoverStyle?: ViewStyle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={
        [
          style,
          hovered && !disabled ? hoverStyle : null,
          { transitionProperty: 'background-color, transform, box-shadow', transitionDuration: '160ms' },
        ] as object
      }
    />
  );
}

/** One of the "More from this seller" cards. The whole card responds to the pointer - it lifts with a
 * blue edge and a soft shadow, the picture eases in and the name turns blue - using the DOM's mouse
 * events, which fire for everything inside the card. */
function RelatedCard({ item, width, productPath }: { item: Product; width?: number; productPath: string }) {
  const [hovered, setHovered] = useState(false);
  const itemStatus = stockStatus(item.stock_level);
  // Web-only events, so typed as an object rather than native View props.
  const hoverEvents = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object;
  const ease = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

  return (
    <View
      {...hoverEvents}
      style={
        [
          { ...card, overflow: 'hidden' },
          width ? { width } : { flex: 1, minWidth: 0 },
          {
            borderColor: hovered ? '#60A5FA' : LINE,
            transform: [{ translateY: hovered ? -4 : 0 }],
            boxShadow: hovered ? '0 16px 32px rgba(37, 99, 235, 0.16)' : '0 1px 2px rgba(17, 24, 39, 0.05)',
            transitionProperty: 'transform, box-shadow, border-color',
            transitionDuration: '220ms',
            transitionTimingFunction: ease,
          },
        ] as object
      }
    >
      <Pressable
        onPress={() => router.push(`${productPath}/${item.id}` as never)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View
          style={{
            width: '100%',
            aspectRatio: 4 / 3,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: '#EAF1FF',
          }}
        >
          {item.image_url ? (
            <Image
              source={{ uri: toSafeImageUri(item.image_url)! }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={
                {
                  width: '100%',
                  height: '100%',
                  transform: [{ scale: hovered ? 1.06 : 1 }],
                  transitionProperty: 'transform',
                  transitionDuration: '320ms',
                  transitionTimingFunction: ease,
                } as object
              }
            />
          ) : (
            <Ionicons name="cube-outline" size={34} color="#93B4F5" />
          )}
        </View>
        <View style={{ paddingTop: 12, paddingBottom: 14, paddingHorizontal: width ? 12 : 14, gap: 4 }}>
          <Text
            style={[text(width ? 13 : 13.5, '700', hovered ? BLUE : INK), { transitionProperty: 'color', transitionDuration: '160ms' } as object]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={text(width ? 13.5 : 14, '800', BLUE)}>{money(item.price)}</Text>
          <Text style={text(12, '600', itemStatus.color)}>{itemStatus.short}</Text>
        </View>
      </Pressable>
    </View>
  );
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
  // Always something to show on the "Sold by" lines: the seller's name when it can be read, else what
  // kind of seller it is - so the details never lose a row.
  const sellerLabel = sellerName ?? (product.seller_role === 'wholesaler' ? 'Wholesaler' : 'Reseller');

  const { data: sellerProducts } = useSupabaseQuery('products', { filters: { seller_id: product.seller_id } });
  const related = useMemo(
    () =>
      (sellerProducts ?? [])
        .filter((p) => p.id !== product.id && p.stock_level > 0 && p.is_listed !== false && Number(p.price) > 0)
        .slice(0, 4),
    [sellerProducts, product.id]
  );

  const lowest = Math.min(minOrder, Math.max(stock, 1));
  const decDisabled = outOfStock || qty <= lowest;
  const incDisabled = outOfStock || qty >= stock;
  const total = Number(product.price) * qty;

  function step(delta: number) {
    setAdded(false);
    setQty((q) => Math.min(Math.max(q + delta, lowest), Math.max(stock, 1)));
  }

  function handleAdd() {
    const result = onAddToCart(qty);
    if (result !== false) setAdded(true);
  }

  const image = (
    <View
      style={{
        width: '100%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DBE6FB',
        backgroundColor: '#EAF1FF',
      }}
    >
      {product.image_url ? (
        <Image source={{ uri: toSafeImageUri(product.image_url)! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Ionicons name="cube-outline" size={72} color="#93B4F5" />
      )}
      <View
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: status.bg,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
        <Text style={text(12.5, '700', status.color)}>{status.short}</Text>
      </View>
    </View>
  );

  const heading = (
    <View style={{ gap: 8 }}>
      {!!product.category && (
        <Text style={text(12, '700', '#2563EB', { letterSpacing: 0.7 })}>{product.category}</Text>
      )}
      <Text style={text(wide ? 30 : 24, '800', INK, { lineHeight: wide ? 36 : 30 })}>{product.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={text(11, '700', BLUE)}>{initialsOf(sellerLabel)}</Text>
        </View>
        <Text style={[text(13.5, '400', SOFT), { flexShrink: 1 }]} numberOfLines={1}>
          Sold by <Text style={text(13.5, '700', INK)}>{sellerLabel}</Text>
        </Text>
      </View>
    </View>
  );

  const buyBox = (
    <View style={{ ...card, padding: 20, gap: 18 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
        <Text style={text(wide ? 36 : 32, '800', outOfStock ? MUTED : BLUE, { lineHeight: wide ? 40 : 36 })}>
          {money(product.price)}
        </Text>
        <Text style={text(13.5, '400', MUTED)}>per unit</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: status.bg }}>
          <Text style={text(13, '700', status.color)}>{status.long}</Text>
        </View>
        <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6' }}>
          <Text style={text(13, '600', '#374151')}>Minimum order: {minOrder}</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: LINE }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={text(12.5, '600', MUTED)}>Quantity</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
            }}
          >
            <HoverPressable
              onPress={() => step(-1)}
              disabled={decDisabled}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: decDisabled ? 0.35 : 1 }}
              hoverStyle={{ backgroundColor: '#F3F4F6' }}
            >
              <Ionicons name="remove" size={22} color="#374151" />
            </HoverPressable>
            <Text style={text(17, '700', INK, { minWidth: 44, textAlign: 'center' })}>{outOfStock ? 0 : qty}</Text>
            <HoverPressable
              onPress={() => step(1)}
              disabled={incDisabled}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: incDisabled ? 0.35 : 1 }}
              hoverStyle={{ backgroundColor: '#F3F4F6' }}
            >
              <Ionicons name="add" size={22} color="#374151" />
            </HoverPressable>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={text(12.5, '600', MUTED)}>Total</Text>
          <Text style={text(22, '800', outOfStock ? '#9CA3AF' : INK)}>{money(outOfStock ? 0 : total)}</Text>
        </View>
      </View>

      <HoverPressable
        onPress={handleAdd}
        disabled={outOfStock}
        accessibilityRole="button"
        style={{
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          backgroundColor: outOfStock ? '#9CA3AF' : added ? '#15803D' : '#EA580C',
        }}
        // Darker and a touch raised under the pointer; the "added" green just deepens.
        hoverStyle={{
          backgroundColor: added ? '#166534' : '#C2410C',
          transform: [{ translateY: -1 }],
          boxShadow: '0 8px 18px rgba(194, 65, 12, 0.28)',
        } as ViewStyle}
      >
        <Text style={text(16.5, '700', '#FFFFFF')}>
          {outOfStock ? 'Out of stock' : added ? `Added ${qty} to cart` : 'Add to cart'}
        </Text>
      </HoverPressable>

      <Text style={text(12.5, '400', MUTED, { lineHeight: 19 })}>
        Your cart holds items from one seller at a time. Adding this item to a cart that has another seller&apos;s items
        will ask you to clear it first.
      </Text>
    </View>
  );

  // Always drawn, so the About and Details cards keep the same two-card row with or without a
  // description (a product without one says so, rather than leaving Details alone at a third).
  const hasDescription = !!product.description?.trim();
  const about = (
    <View style={{ ...card, padding: 22, gap: 10, flexGrow: 1 }}>
      <Text style={text(17, '800', INK)}>About this product</Text>
      <Text style={text(14.5, '400', hasDescription ? SOFT : '#9CA3AF', { lineHeight: 25 })}>
        {hasDescription ? product.description : "The seller hasn't added a description yet."}
      </Text>
    </View>
  );

  // The same four rows every time; a value that is not known says so instead of dropping the row.
  const detailRows: [string, string][] = [
    ['Category', product.category?.trim() || 'Not categorised'],
    ['Availability', status.short],
    ['Minimum order', `${minOrder} ${minOrder === 1 ? 'unit' : 'units'}`],
    ['Sold by', sellerLabel],
  ];
  const details = (
    <View style={{ ...card, padding: 22, gap: 12, flexGrow: 1 }}>
      <Text style={text(17, '800', INK)}>Details</Text>
      <View style={{ gap: 10 }}>
        {detailRows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
            <Text style={text(14, '400', MUTED)}>{label}</Text>
            <Text style={[text(14, '600', INK), { flex: 1, textAlign: 'right' }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const relatedCard = (item: Product, width?: number) => (
    <RelatedCard key={item.id} item={item} width={width} productPath={productPath} />
  );

  const moreFromSeller = related.length > 0 && (
    <View style={{ gap: 14 }}>
      <Text style={text(wide ? 18 : 16, '800', INK)} numberOfLines={1}>
        {sellerName ? `More from ${sellerName}` : 'More from this seller'}
      </Text>
      {wide ? (
        // Always four equal columns across the full width: a short list is padded with empty slots, so
        // one or two products never stretch into huge cards.
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {related.map((item) => relatedCard(item))}
          {Array.from({ length: Math.max(0, 4 - related.length) }, (_, i) => (
            <View key={`slot-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
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
      // Fills the width the screen gives it (the content area beside the side panel); only on a very
      // wide screen is it held to 1400 and centred, so it never stretches thin.
      <View
        style={{ gap: 28, paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40, width: '100%', maxWidth: 1400, alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : undefined)} hitSlop={6}>
            <Text style={text(13, '600', '#2563EB')}>Shop</Text>
          </Pressable>
          {!!product.category && (
            <>
              <Text style={text(13, '400', '#9CA3AF')}>/</Text>
              <Text style={text(13, '600', MUTED)}>{product.category}</Text>
            </>
          )}
          <Text style={text(13, '400', '#9CA3AF')}>/</Text>
          <Text style={text(13, '600', INK)} numberOfLines={1}>
            {product.name}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, maxWidth: 560, minWidth: 0 }}>{image}</View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0, gap: 20 }}>
            {heading}
            {buyBox}
          </View>
        </View>

        {/* Stretched, so the two cards are the same height and Details fills its column. */}
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'stretch' }}>
          <View style={{ flex: 2, minWidth: 0 }}>{about}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{details}</View>
        </View>

        {moreFromSeller}
      </View>
    );
  }

  return (
    <View style={{ gap: 18, paddingHorizontal: 16, paddingTop: 16 }}>
      {image}
      {heading}
      {buyBox}
      {about}
      {details}
      {moreFromSeller}
    </View>
  );
}
