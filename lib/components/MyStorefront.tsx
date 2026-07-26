// lib/components/MyStorefront.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { SearchFilterSheet } from './SearchFilterSheet';
import { filterBySearch } from '../utils/search';
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
  if (stockLevel <= 0) return { label: 'Out of stock', bg: 'bg-gray-900/80' };
  if (stockLevel < LOW_STOCK_THRESHOLD) return { label: 'Low stock', bg: 'bg-amber-500/90' };
  return { label: 'In stock', bg: 'bg-emerald-600/90' };
}

function StorefrontCard({ item, basePath }: { item: Product; basePath: string }) {
  const outOfStock = item.stock_level <= 0;
  const badge = stockBadge(item.stock_level);
  const detailHref = item.catalog_id ? `${basePath}/catalog/${item.catalog_id}` : null;

  const content = (
    <>
      <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-3xl">🖥️</Text>
        )}
        <View className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 ${badge.bg}`}>
          <Text className="text-[9px] font-bold uppercase tracking-wide text-white">{badge.label}</Text>
        </View>
      </View>

      {item.category && (
        <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
      )}
      <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="text-base font-bold text-gray-900">NPR {Number(item.price).toLocaleString()}</Text>

      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-gray-400">{outOfStock ? 'Restock to sell' : `${item.stock_level} in stock`}</Text>
        {detailHref && <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />}
      </View>
    </>
  );

  // The width class must stay on this outer View no matter what - nesting it
  // inside a conditional Pressable instead (as before) left Pressable as the
  // flex-wrap item with no width of its own, which broke the 2-column grid
  // for every tappable card.
  return (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3">
      {detailHref ? <Pressable onPress={() => router.push(detailHref)}>{content}</Pressable> : content}
    </View>
  );
}

// Auto-credited from a delivered wholesale purchase but never priced yet -
// invisible to real customers (MyStorefront's `listed` filter excludes it),
// so without a nudge here a reseller would have no way to discover or price
// a fresh purchase now that My Inventory no longer exists as a separate tab.
function NeedsPriceRow({ item, basePath }: { item: Product; basePath: string }) {
  const detailHref = item.catalog_id ? `${basePath}/catalog/${item.catalog_id}` : null;
  return (
    <Pressable
      onPress={() => detailHref && router.push(detailHref)}
      className="mb-2 flex-row items-center gap-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2.5"
    >
      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white">
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
        <Text className="mt-0.5 text-[11px] text-amber-700">{item.stock_level} purchased · tap to set a price</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#D97706" />
    </Pressable>
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

  // A row with no price was never actually priced for sale (e.g. auto-credited
  // from a wholesale purchase, or "Add" was tapped without setting a price) -
  // it isn't a real listing yet, so don't show it as one. is_listed is the
  // seller's explicit market on/off switch, independent of price/stock.
  const listed = useMemo(
    () => (products ?? []).filter((p) => Number(p.price) > 0 && p.is_listed !== false),
    [products]
  );
  const needsPrice = useMemo(
    () => (products ?? []).filter((p) => Number(p.price) <= 0 && p.is_listed !== false),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    listed.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [listed]);

  const filtered = useMemo(() => {
    let list = filterBySearch(listed, search);
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
  }, [listed, search, category, sortBy]);

  if (!isLoading && listed.length === 0 && needsPrice.length === 0) {
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

      {needsPrice.length > 0 && (
        <View className="mb-4">
          <Text className="mb-2 text-sm font-semibold text-gray-900">
            Needs a price ({needsPrice.length})
          </Text>
          {needsPrice.map((item) => (
            <NeedsPriceRow key={item.id} item={item} basePath={basePath} />
          ))}
        </View>
      )}

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
      {!isLoading && filtered.length === 0 && (
        <Text className="text-gray-500">
          {listed.length === 0 ? 'Nothing live in the marketplace yet.' : 'No products match your search.'}
        </Text>
      )}

      <View className="flex-row flex-wrap justify-between">
        {filtered.map((item) => (
          <StorefrontCard key={item.id} item={item} basePath={basePath} />
        ))}
      </View>
    </>
  );
}
