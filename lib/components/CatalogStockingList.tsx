// lib/components/CatalogStockingList.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery, useSupabaseUpsert, useSupabaseUpdate } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';
import { filterBySearch } from '../utils/search';
import { SearchSuggestions } from './SearchSuggestions';
import type { CatalogProduct, Product } from '../../types/database.types';

function StockRow({
  item,
  existing,
  priceLabel,
  userId,
  capToPurchasedStock,
  basePath,
}: {
  item: CatalogProduct;
  existing: Product | undefined;
  priceLabel: string;
  userId: string;
  capToPurchasedStock: boolean;
  basePath: string;
}) {
  const upsertProduct = useSupabaseUpsert('products', 'seller_id,catalog_id');
  const updateProduct = useSupabaseUpdate('products');
  const [qty, setQty] = useState(existing?.stock_level ?? 0);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [saving, setSaving] = useState(false);

  const isStocked = !!existing;
  const dirty = qty !== (existing?.stock_level ?? 0) || price !== (existing ? String(existing.price) : '');
  const purchasedStock = existing?.purchased_stock ?? 0;
  const purchasePrice = existing?.purchase_price ?? null;
  const atPurchasedCap = capToPurchasedStock && qty >= purchasedStock;
  const nothingPurchased = capToPurchasedStock && purchasedStock <= 0;

  async function handleToggleListed(nextValue: boolean) {
    if (!existing) return;
    try {
      await updateProduct.mutateAsync({ id: existing.id, values: { is_listed: nextValue } });
    } catch (err) {
      showAlert('Could not update availability', getErrorMessage(err));
    }
  }

  async function handleSave() {
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
        catalog_id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        price: Number.isNaN(priceNum) ? 0 : priceNum,
        stock_level: qty,
        min_order_qty: existing?.min_order_qty ?? 1,
      });
    } catch (err) {
      showAlert('Could not update stock', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mb-2.5 rounded-xl border border-gray-200 bg-white p-3.5">
      <Pressable onPress={() => router.push(`${basePath}/catalog/${item.id}`)}>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Text className="text-lg">📦</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
              {item.name}
            </Text>
            {item.category && <Text className="mt-0.5 text-[11px] text-orange-600">{item.category}</Text>}
            {isStocked && <Text className="mt-0.5 text-[11px] text-gray-400">Currently stocked</Text>}
          </View>
        </View>

        {item.description && <Text className="mt-2 text-[11px] leading-4 text-gray-500">{item.description}</Text>}
      </Pressable>

      {capToPurchasedStock && (
        <Text className="mt-2 text-[11px] font-medium text-gray-500">
          {purchasedStock > 0
            ? `Purchased from wholesale: ${purchasedStock} units${
                purchasePrice != null ? ` @ NPR ${Number(purchasePrice).toLocaleString()}` : ''
              }`
            : 'Buy this from Wholesale first to list it here.'}
        </Text>
      )}

      {isStocked && (
        <View className="mt-3 flex-row items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <Text className="text-xs font-medium text-gray-600">Available on market</Text>
          <Switch
            value={existing?.is_listed ?? true}
            onValueChange={handleToggleListed}
            disabled={updateProduct.isPending}
            trackColor={{ false: '#D1D5DB', true: '#FDBA74' }}
            thumbColor={(existing?.is_listed ?? true) ? '#F97316' : '#F3F4F6'}
          />
        </View>
      )}

      <View className="mt-3 flex-row items-center gap-2">
        <View className="flex-row items-center rounded-lg border border-gray-300">
          <Pressable onPress={() => setQty((q) => Math.max(0, q - 1))} className="px-3 py-2">
            <Text className="text-lg text-gray-500">−</Text>
          </Pressable>
          <Text className="w-10 text-center text-sm font-semibold text-gray-900">{qty}</Text>
          <Pressable
            onPress={() => setQty((q) => (capToPurchasedStock ? Math.min(purchasedStock, q + 1) : q + 1))}
            disabled={atPurchasedCap}
            className="px-3 py-2 disabled:opacity-30"
          >
            <Text className="text-lg text-gray-500">+</Text>
          </Pressable>
        </View>

        <View className="flex-1">
          <Text className="mb-0.5 text-[10px] text-gray-400">{priceLabel} (NPR)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!nothingPurchased}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900"
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty || nothingPurchased}
          className="items-center rounded-lg bg-orange-500 px-3 py-2.5 disabled:opacity-40"
        >
          <Text className="text-xs font-semibold text-white">{saving ? 'Saving…' : isStocked ? 'Update' : 'Add'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CatalogStockingList({
  priceLabel,
  capToPurchasedStock = false,
  onlyStocked = false,
  basePath,
}: {
  priceLabel: string;
  capToPurchasedStock?: boolean;
  onlyStocked?: boolean;
  basePath: string;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: catalog, isLoading: loadingCatalog } = useSupabaseQuery('catalog_products', {
    filters: { is_active: true },
    orderBy: { column: 'name' },
  });
  const { data: myProducts, isLoading: loadingMine } = useSupabaseQuery('products', {
    filters: userId ? { seller_id: userId } : {},
    enabled: !!userId,
  });

  const myProductByCatalogId = useMemo(() => {
    const map = new Map<string, Product>();
    (myProducts ?? []).forEach((p) => {
      if (p.catalog_id) map.set(p.catalog_id, p);
    });
    return map;
  }, [myProducts]);

  const scoped = useMemo(
    () => (onlyStocked ? (catalog ?? []).filter((item) => myProductByCatalogId.has(item.id)) : catalog ?? []),
    [catalog, onlyStocked, myProductByCatalogId]
  );
  const filtered = useMemo(() => filterBySearch(scoped, search), [scoped, search]);
  const suggestions = useMemo(() => (search.trim() ? filtered.slice(0, 5) : []), [filtered, search]);

  const isLoading = loadingCatalog || loadingMine;

  if (!userId) return null;

  return (
    <View>
      <View className="relative z-10 mb-3">
        <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Search by name or model…"
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-sm text-gray-900"
          />
        </View>
        <SearchSuggestions
          items={suggestions}
          visible={searchFocused}
          onSelect={(item) => {
            setSearch('');
            setSearchFocused(false);
            router.push(`${basePath}/catalog/${item.id}`);
          }}
        />
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && onlyStocked && scoped.length === 0 && (
        <Text className="text-gray-500">
          Nothing purchased yet — buy stock from a wholesaler and it'll show up here.
        </Text>
      )}
      {!isLoading && !onlyStocked && (catalog?.length ?? 0) === 0 && (
        <Text className="text-gray-500">No catalog items available yet — check back soon.</Text>
      )}
      {!isLoading && scoped.length > 0 && filtered.length === 0 && (
        <Text className="text-gray-500">No items match your search.</Text>
      )}
      {filtered.map((item) => (
        <StockRow
          key={item.id}
          item={item}
          existing={myProductByCatalogId.get(item.id)}
          priceLabel={priceLabel}
          userId={userId}
          capToPurchasedStock={capToPurchasedStock}
          basePath={basePath}
        />
      ))}
    </View>
  );
}
