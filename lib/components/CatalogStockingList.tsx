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
import { SearchFilterSheet } from './SearchFilterSheet';
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
  const purchasedStock = existing?.purchased_stock ?? 0;
  // Resellers can't hand-pick a listing quantity - it's whatever they've
  // actually got in stock, credited automatically from wholesale purchases.
  // Only wholesalers (capToPurchasedStock false) set their own quantity here.
  const [qty, setQty] = useState(existing?.stock_level ?? 0);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [saving, setSaving] = useState(false);

  const isStocked = !!existing;
  const effectiveQty = capToPurchasedStock ? (existing?.stock_level ?? purchasedStock) : qty;
  const dirty = capToPurchasedStock
    ? price !== (existing ? String(existing.price) : '')
    : qty !== (existing?.stock_level ?? 0) || price !== (existing ? String(existing.price) : '');
  const purchasePrice = existing?.purchase_price ?? null;
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
    const priceNum = parseFloat(price);
    if (effectiveQty > 0 && (Number.isNaN(priceNum) || priceNum <= 0)) {
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
        stock_level: effectiveQty,
        min_order_qty: existing?.min_order_qty ?? 1,
      });
    } catch (err) {
      showAlert('Could not update stock', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const metaText = capToPurchasedStock
    ? purchasedStock > 0
      ? `${purchasedStock} purchased${purchasePrice != null ? ` @ NPR ${Number(purchasePrice).toLocaleString()}` : ''}`
      : 'Buy from Wholesale first'
    : isStocked
      ? 'Stocked'
      : null;

  return (
    <View className="mb-2 rounded-xl border border-gray-200 bg-white p-2.5">
      <View className="flex-row items-center gap-2.5">
        <Pressable
          onPress={() => router.push(`${basePath}/catalog/${item.id}`)}
          className="flex-1 flex-row items-center gap-2.5"
        >
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Text className="text-base">📦</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="mt-0.5 text-[11px] text-gray-400" numberOfLines={1}>
              {item.category && <Text className="text-orange-600">{item.category}</Text>}
              {item.category && metaText && '  ·  '}
              {metaText}
            </Text>
          </View>
        </Pressable>
        {isStocked && (
          <Switch
            value={existing?.is_listed ?? true}
            onValueChange={handleToggleListed}
            disabled={updateProduct.isPending}
            trackColor={{ false: '#D1D5DB', true: '#FDBA74' }}
            thumbColor={(existing?.is_listed ?? true) ? '#F97316' : '#F3F4F6'}
          />
        )}
      </View>

      <View className="mt-2 flex-row items-center gap-1.5">
        {capToPurchasedStock ? (
          <View className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5">
            <Text className="text-sm font-semibold text-gray-900">{effectiveQty} in stock</Text>
          </View>
        ) : (
          <View className="shrink-0 flex-row items-center rounded-lg border border-gray-300">
            <Pressable onPress={() => setQty((q) => Math.max(0, q - 1))} className="px-2 py-1.5">
              <Text className="text-base text-gray-500">−</Text>
            </Pressable>
            <Text className="w-6 text-center text-sm font-semibold text-gray-900">{qty}</Text>
            <Pressable onPress={() => setQty((q) => q + 1)} className="px-2 py-1.5">
              <Text className="text-base text-gray-500">+</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder={priceLabel}
          keyboardType="decimal-pad"
          editable={!nothingPurchased}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        />

        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty || nothingPurchased}
          className="shrink-0 items-center rounded-lg bg-orange-500 px-2.5 py-1.5 disabled:opacity-40"
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
  useFilterSheet = false,
  basePath,
}: {
  priceLabel: string;
  capToPurchasedStock?: boolean;
  onlyStocked?: boolean;
  useFilterSheet?: boolean;
  basePath: string;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const categories = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((item) => item.category && set.add(item.category));
    return Array.from(set);
  }, [scoped]);
  const categoryScoped = useMemo(
    () => (category ? scoped.filter((item) => item.category === category) : scoped),
    [scoped, category]
  );
  const filtered = useMemo(() => filterBySearch(categoryScoped, search), [categoryScoped, search]);
  const suggestions = useMemo(() => (search.trim() ? filtered.slice(0, 5) : []), [filtered, search]);

  const isLoading = loadingCatalog || loadingMine;

  if (!userId) return null;

  const searchSummary = [search, category].filter(Boolean).join(' · ');

  return (
    <View>
      <View className="relative z-10 mb-3">
        {useFilterSheet ? (
          <Pressable
            onPress={() => setSheetOpen(true)}
            className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5"
          >
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text className={`ml-2 flex-1 text-sm ${searchSummary ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
              {searchSummary || 'Search by name, model, or category…'}
            </Text>
            <Ionicons name="options-outline" size={18} color="#9CA3AF" />
          </Pressable>
        ) : (
          <>
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
          </>
        )}
      </View>

      {useFilterSheet && (
        <SearchFilterSheet
          visible={sheetOpen}
          initialSearch={search}
          initialCategory={category}
          categories={categories}
          onApply={({ search: nextSearch, category: nextCategory }) => {
            setSearch(nextSearch);
            setCategory(nextCategory);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

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
