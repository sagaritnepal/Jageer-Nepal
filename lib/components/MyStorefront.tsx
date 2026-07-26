// lib/components/MyStorefront.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery, useSupabaseUpdate } from '../hooks/useSupabase';
import { SearchFilterSheet } from './SearchFilterSheet';
import { filterBySearch } from '../utils/search';
import { showAlert, getErrorMessage } from '../utils/alert';
import { LOW_STOCK_THRESHOLD } from '../constants/stock';
import type { Product, UserRole } from '../../types/database.types';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  name: 'Name',
};

function stockBadge(stockLevel: number) {
  if (stockLevel <= 0) return { label: 'Out of stock', bg: 'bg-red-600' };
  if (stockLevel < LOW_STOCK_THRESHOLD) return { label: 'Low stock', bg: 'bg-amber-500/90' };
  return { label: 'In stock', bg: 'bg-emerald-600/90' };
}

function EditablePrice({ item }: { item: Product }) {
  const updateProduct = useSupabaseUpdate('products');
  const [editing, setEditing] = useState(Number(item.price) <= 0);
  const [price, setPrice] = useState(Number(item.price) > 0 ? String(item.price) : '');
  const [saving, setSaving] = useState(false);

  // Re-sync once the save round-trips and the fresh row comes back through
  // the query - otherwise a second edit would start from the stale value.
  useEffect(() => {
    if (!editing) setPrice(Number(item.price) > 0 ? String(item.price) : '');
  }, [item.price, editing]);

  async function handleSave() {
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      showAlert('Set a price', 'Enter a valid selling price.');
      return;
    }
    setSaving(true);
    try {
      await updateProduct.mutateAsync({ id: item.id, values: { price: priceNum } });
      setEditing(false);
    } catch (err) {
      showAlert('Could not update price', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <View className="flex-row items-center gap-1.5">
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Set price"
          keyboardType="decimal-pad"
          autoFocus={Number(item.price) > 0}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="rounded-lg bg-orange-500 px-2.5 py-1.5 disabled:opacity-50"
        >
          <Text className="text-xs font-semibold text-white">{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={() => setEditing(true)} className="flex-row items-center gap-1.5">
      <Text className="text-base font-bold text-gray-900">NPR {Number(item.price).toLocaleString()}</Text>
      <Ionicons name="pencil" size={13} color="#9CA3AF" />
    </Pressable>
  );
}

function StorefrontCard({ item, basePath }: { item: Product; basePath: string }) {
  const updateProduct = useSupabaseUpdate('products');
  const outOfStock = item.stock_level <= 0;
  const badge = stockBadge(item.stock_level);
  const detailHref = item.catalog_id ? `${basePath}/catalog/${item.catalog_id}` : null;

  async function handleToggleAvailable(next: boolean) {
    try {
      await updateProduct.mutateAsync({ id: item.id, values: { is_listed: next } });
    } catch (err) {
      showAlert('Could not update availability', getErrorMessage(err));
    }
  }

  return (
    <View
      className={`mb-3 flex-row gap-3 rounded-xl border p-3 ${
        outOfStock ? 'border-red-200 bg-red-50 opacity-60' : 'border-gray-200 bg-white'
      }`}
    >
      <Pressable
        onPress={() => detailHref && router.push(detailHref)}
        className="h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-2xl">🖥️</Text>
        )}
      </Pressable>

      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Pressable onPress={() => detailHref && router.push(detailHref)} className="flex-1">
            {item.category && (
              <Text className="text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
            )}
            <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
          <Switch
            value={item.is_listed ?? true}
            onValueChange={handleToggleAvailable}
            trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
            thumbColor={(item.is_listed ?? true) ? '#4F46E5' : '#F3F4F6'}
          />
        </View>

        <View className="mt-1.5 flex-row items-center justify-between">
          <EditablePrice item={item} />
          <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
            <Text className="text-[9px] font-bold uppercase tracking-wide text-white">{badge.label}</Text>
          </View>
        </View>

        <Text className={`mt-1 text-[11px] ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
          {outOfStock ? 'Restock to sell' : `${item.stock_level} in stock`}
        </Text>
      </View>
    </View>
  );
}

export function MyStorefront({
  sellerRole,
  note,
  emptyText,
  basePath,
}: {
  sellerRole: UserRole;
  note: string;
  emptyText: string;
  basePath: string;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { data: products, isLoading } = useSupabaseQuery('products', {
    filters: { seller_id: userId ?? '', seller_role: sellerRole },
    enabled: !!userId,
  });

  // Available (is_listed) is the seller's explicit on/off switch - turn it
  // off and the item drops out of the marketplace entirely, whether or not
  // it's priced yet. Price is editable right on the card now, so there's no
  // separate "needs a price" gate anymore.
  const visible = useMemo(() => (products ?? []).filter((p) => p.is_listed !== false), [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    visible.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [visible]);

  const filtered = useMemo(() => {
    let list = filterBySearch(visible, search);
    if (category) {
      list = list.filter((p) => p.category === category);
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_desc':
        sorted.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [visible, search, category, sortBy]);

  if (!isLoading && visible.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-12">
        <Ionicons name="storefront-outline" size={36} color="#D1D5DB" />
        <Text className="mt-3 text-sm font-semibold text-gray-700">Nothing live yet</Text>
        <Text className="mt-1 px-8 text-center text-xs text-gray-400">{emptyText}</Text>
      </View>
    );
  }

  const searchSummary = [search, category].filter(Boolean).join(' · ');

  return (
    <>
      <Text className="mb-3 text-xs text-gray-400">{note}</Text>

      <Pressable
        onPress={() => setSheetOpen(true)}
        className="mb-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5"
      >
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <Text className={`ml-2 flex-1 text-sm ${searchSummary ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
          {searchSummary || 'Search by name or model…'}
        </Text>
        <Ionicons name="options-outline" size={18} color="#9CA3AF" />
      </Pressable>

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

      <View className="mb-4">
        <Pressable
          onPress={() => setShowSortMenu((v) => !v)}
          className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2"
        >
          <Text className="text-sm text-gray-700">Sort: {SORT_LABELS[sortBy]}</Text>
          <Text className="text-gray-400">{showSortMenu ? '▲' : '▼'}</Text>
        </Pressable>
        {showSortMenu && (
          <View className="mt-1 rounded-lg border border-gray-200 bg-white">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setSortBy(option);
                  setShowSortMenu(false);
                }}
                className="px-4 py-2.5"
              >
                <Text className={option === sortBy ? 'font-semibold text-orange-600' : 'text-gray-700'}>
                  {SORT_LABELS[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && filtered.length === 0 && <Text className="text-gray-500">No products match your search.</Text>}

      <View>
        {filtered.map((item) => (
          <StorefrontCard key={item.id} item={item} basePath={basePath} />
        ))}
      </View>
    </>
  );
}
