// lib/components/CatalogProductDetail.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, type TextStyle, type ViewStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseRow, useSupabaseQuery, useSupabaseUpsert } from '../hooks/useSupabase';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { decimalInput } from '../utils/number';
import { showAlert, getErrorMessage } from '../utils/alert';
import { toSafeImageUri } from '../utils/image';
import { HoverPressable } from './ProductDetailContent';

// Sizes and spacing are set inline (as on the product page and checkout), so they always apply.
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

/** A catalog item's page for the seller: what it is, and the form that stocks it or updates the
 * listing (how many, at what price). A reseller's version caps the stock at what they bought from
 * wholesale and shows the wholesale price, their resale price and the margin between them. */
export function CatalogProductDetail({
  priceLabel,
  capToPurchasedStock = false,
}: {
  priceLabel: string;
  capToPurchasedStock?: boolean;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: item, isLoading } = useSupabaseRow('catalog_products', id);
  const { data: myProducts } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });
  const existing = (myProducts ?? []).find((p) => p.catalog_id === id);

  const upsertProduct = useSupabaseUpsert('products', 'seller_id,catalog_id');
  const [qty, setQty] = useState(existing?.stock_level ?? 0);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  // What customers read under "About this product" on the listing. It starts as the listing's own
  // text, else the catalog's; the seller can write their own, and it is saved with the listing.
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const wide = useIsWideWeb();

  // `existing` comes from a second, separately-loading query - it's almost
  // never ready by the time these useState initializers run, so re-sync once
  // it (or a different stocked item) actually arrives.
  useEffect(() => {
    if (existing) {
      setQty(existing.stock_level);
      setPrice(String(existing.price));
    }
  }, [existing?.id]);

  // The description arrives with the catalog item and the listing; start the editor from it once.
  const savedDescription = (existing?.description ?? item?.description ?? '').trim();
  useEffect(() => {
    setDescription(savedDescription);
  }, [item?.id, existing?.id]);

  if (isLoading || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const isStocked = !!existing;
  const dirty =
    qty !== (existing?.stock_level ?? 0) ||
    price !== (existing ? String(existing.price) : '') ||
    description.trim() !== savedDescription;
  const purchasedStock = existing?.purchased_stock ?? 0;
  const purchasePrice = existing?.purchase_price ?? null;
  const atPurchasedCap = capToPurchasedStock && qty >= purchasedStock;
  const nothingPurchased = capToPurchasedStock && purchasedStock <= 0;

  const typedPrice = parseFloat(price);
  const resalePrice = Number.isNaN(typedPrice) ? null : typedPrice;
  const margin =
    purchasePrice != null && resalePrice != null
      ? { amount: resalePrice - purchasePrice, pct: purchasePrice > 0 ? ((resalePrice - purchasePrice) / purchasePrice) * 100 : 0 }
      : null;

  async function handleSave() {
    if (!userId) return;
    if (capToPurchasedStock && qty > purchasedStock) {
      showAlert('Not enough purchased stock', `You've only bought ${purchasedStock} of this item from wholesale.`);
      return;
    }
    const priceNum = parseFloat(price);
    if (qty > 0 && (Number.isNaN(priceNum) || priceNum <= 0)) {
      showAlert('Set a price', 'Enter a valid price before stocking this item.');
      return;
    }
    setSaving(true);
    try {
      await upsertProduct.mutateAsync({
        seller_id: userId,
        catalog_id: item!.id,
        name: item!.name,
        // The seller's own words; emptied, it falls back to the catalog's text.
        description: description.trim() ? description.trim() : item!.description,
        category: item!.category,
        image_url: item!.image_url,
        price: Number.isNaN(priceNum) ? 0 : priceNum,
        stock_level: qty,
        min_order_qty: existing?.min_order_qty ?? 1,
      });
      showAlert('Saved', isStocked ? 'Your listing was updated.' : 'Added to your listings.');
    } catch (err) {
      showAlert('Could not update stock', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ---- The page. Built once so the phone layout (one column) and the wide web layout (the photo
  // beside the listing form) show exactly the same things.
  const status = isStocked
    ? { label: 'In your listings', color: '#15803D', bg: '#F0FDF4' }
    : { label: 'Not in your listings', color: '#4B5563', bg: '#F3F4F6' };

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
      {item.image_url ? (
        <Image source={{ uri: toSafeImageUri(item.image_url)! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
        <Text style={text(12.5, '700', status.color)}>{status.label}</Text>
      </View>
    </View>
  );

  const heading = (
    <View style={{ gap: 8 }}>
      {!!item.category && <Text style={text(12, '700', '#2563EB', { letterSpacing: 0.7 })}>{item.category}</Text>}
      <Text style={text(wide ? 30 : 24, '800', INK, { lineHeight: wide ? 36 : 30 })}>{item.name}</Text>
    </View>
  );

  const stepButton = (label: string, icon: 'remove' | 'add', onPress: () => void, disabled: boolean) => (
    <HoverPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
      hoverStyle={{ backgroundColor: '#F3F4F6' }}
    >
      <Ionicons name={icon} size={22} color="#374151" />
    </HoverPressable>
  );

  const listingPanel = (
    <View style={{ ...card, padding: 20, gap: 16 }}>
      <Text style={text(17, '800', INK)}>{isStocked ? 'Update your listing' : 'Stock this item'}</Text>

      {capToPurchasedStock && purchasedStock <= 0 && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: LINE }}>
          <Text style={text(13, '500', SOFT, { lineHeight: 19 })}>Buy this from Wholesale first to list it here.</Text>
        </View>
      )}

      {capToPurchasedStock && purchasePrice != null && (
        <View style={{ gap: 12 }}>
          <Text style={text(13, '500', SOFT)}>
            Purchased from wholesale: {purchasedStock} unit{purchasedStock === 1 ? '' : 's'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#F9FAFB' }}>
              <Text style={text(11.5, '500', MUTED)}>Wholesale price</Text>
              <Text style={text(18, '800', INK, { marginTop: 4 })}>{money(purchasePrice)}</Text>
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#ECFDF5' }}>
              <Text style={text(11.5, '500', '#047857')}>Your resale price</Text>
              <Text style={text(18, '800', '#047857', { marginTop: 4 })}>{resalePrice != null ? money(resalePrice) : '—'}</Text>
            </View>
          </View>
          {margin && (
            <View style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#EFF6FF' }}>
              <Text style={text(12.5, '700', BLUE)}>
                Margin: NPR {margin.amount.toLocaleString()} ({margin.pct.toFixed(1)}%)
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: LINE }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={text(12.5, '600', MUTED)}>Quantity</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, backgroundColor: '#FFFFFF' }}>
            {stepButton('Decrease quantity', 'remove', () => setQty((q) => Math.max(0, q - 1)), qty <= 0)}
            <Text style={text(17, '700', INK, { minWidth: 44, textAlign: 'center' })}>{qty}</Text>
            {stepButton(
              'Increase quantity',
              'add',
              () => setQty((q) => (capToPurchasedStock ? Math.min(purchasedStock, q + 1) : q + 1)),
              atPurchasedCap
            )}
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 180, gap: 6 }}>
          <Text style={text(12.5, '600', MUTED)}>{priceLabel} (NPR)</Text>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(decimalInput(v))}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            editable={!nothingPurchased}
            style={{
              height: 50,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: INK,
              backgroundColor: nothingPurchased ? '#F3F4F6' : '#FFFFFF',
            }}
          />
        </View>
      </View>

      <HoverPressable
        onPress={handleSave}
        disabled={saving || !dirty || nothingPurchased}
        accessibilityRole="button"
        style={{
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          backgroundColor: '#EA580C',
          opacity: saving || !dirty || nothingPurchased ? 0.4 : 1,
        }}
        hoverStyle={
          { backgroundColor: '#C2410C', transform: [{ translateY: -1 }], boxShadow: '0 8px 18px rgba(194, 65, 12, 0.28)' } as ViewStyle
        }
      >
        <Text style={text(16.5, '700', '#FFFFFF')}>{saving ? 'Saving…' : isStocked ? 'Update listing' : 'Add to my listings'}</Text>
      </HoverPressable>
    </View>
  );

  // The seller writes this: it is what a customer reads under "About this product". It is saved with
  // the listing by the same button (Update listing / Add to my listings). Until something has been
  // bought from wholesale there is no listing to save it to, so it is only shown.
  const canWrite = !nothingPurchased;
  const about = (
    <View style={{ ...card, padding: 22, gap: 10, flexGrow: 1 }}>
      <Text style={text(17, '800', INK)}>About this product</Text>
      {canWrite ? (
        <>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Write what customers should know - what it is, what is in the box, who it suits ..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1500}
            accessibilityLabel="Product description"
            style={{
              minHeight: 130,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14.5,
              lineHeight: 22,
              color: INK,
              backgroundColor: '#FFFFFF',
              textAlignVertical: 'top',
            }}
          />
          <Text style={text(12.5, '400', MUTED, { lineHeight: 18 })}>
            Customers read this on the product page. Saved with your listing - leave it empty to use the catalog's own text.
          </Text>
        </>
      ) : (
        <Text style={text(14.5, '400', savedDescription ? SOFT : '#9CA3AF', { lineHeight: 25 })}>
          {savedDescription || 'No description has been added for this item.'}
        </Text>
      )}
    </View>
  );

  // The same rows every time; a value that is not known says so instead of dropping the row.
  const detailRows: [string, string][] = [
    ['Category', item.category?.trim() || 'Not categorised'],
    ['Status', status.label],
    ['In stock', `${existing?.stock_level ?? 0}`],
    ...(existing && Number(existing.price) > 0 ? ([['Your price', money(existing.price)]] as [string, string][]) : []),
    ...(capToPurchasedStock && purchasePrice != null
      ? ([['Wholesale price', money(purchasePrice)], ['Purchased', `${purchasedStock}`]] as [string, string][])
      : []),
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

  if (wide) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ gap: 28, paddingHorizontal: 32, paddingTop: 24, width: '100%', maxWidth: 1400, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : undefined)} hitSlop={6}>
              <Text style={text(13, '600', '#2563EB')}>Shop</Text>
            </Pressable>
            {!!item.category && (
              <>
                <Text style={text(13, '400', '#9CA3AF')}>/</Text>
                <Text style={text(13, '600', MUTED)}>{item.category}</Text>
              </>
            )}
            <Text style={text(13, '400', '#9CA3AF')}>/</Text>
            <Text style={text(13, '600', INK)} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, maxWidth: 560, minWidth: 0 }}>{image}</View>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0, gap: 20 }}>
              {heading}
              {listingPanel}
            </View>
          </View>

          {/* Stretched, so the two cards are the same height and Details fills its column. */}
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'stretch' }}>
            <View style={{ flex: 2, minWidth: 0 }}>{about}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{details}</View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ gap: 18, paddingHorizontal: 16, paddingTop: 16 }}>
        {image}
        {heading}
        {listingPanel}
        {about}
        {details}
      </View>
    </ScrollView>
  );
}
