// app/(client)/market.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useCartStore } from '../../lib/hooks/useCart';
import { SearchFilterSheet } from '../../lib/components/SearchFilterSheet';
import { showAlert } from '../../lib/utils/alert';
import { filterBySearch } from '../../lib/utils/search';
import type { Product } from '../../types/database.types';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  name: 'Name',
};

function ProductCard({ item, onAdd }: { item: Product; onAdd: (product: Product) => void }) {
  return (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3">
      <Pressable onPress={() => router.push(`/(client)/product/${item.id}`)}>
        <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-3xl">🖥️</Text>
          )}
        </View>

        {item.category && (
          <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
        )}
        <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-base font-bold text-gray-900">NPR {Number(item.price).toLocaleString()}</Text>
        <Text className="mb-2 mt-0.5 text-xs text-gray-400">{item.stock_level} in stock</Text>
      </Pressable>

      <Pressable onPress={() => onAdd(item)} className="items-center rounded-lg bg-orange-500 py-2">
        <Text className="text-xs font-semibold text-white">Add to Cart</Text>
      </Pressable>
    </View>
  );
}

export default function ClientMarket() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const cartItems = useCartStore((state) => state.items);
  const cartSellerId = useCartStore((state) => state.sellerId);
  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const { data: products, isLoading } = useSupabaseQuery('products', {
    filters: { seller_role: 'reseller' },
  });

  const inStockProducts = useMemo(
    () => (products ?? []).filter((p) => p.stock_level > 0 && p.is_listed !== false),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    inStockProducts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [inStockProducts]);

  const filtered = useMemo(() => {
    let list = filterBySearch(inStockProducts, search);
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
  }, [inStockProducts, search, category, sortBy]);

  function handleAdd(product: Product) {
    const added = addToCart(product);
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
              addToCart(product);
            },
          },
        ]
      );
    }
  }

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const searchSummary = [search, category].filter(Boolean).join(' · ');

  return (
    <ScrollView
      className="flex-1 bg-gray-50 px-6 pt-4"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-4 flex-row items-center justify-end">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.push('/(client)/quotes')}>
            <Text className="text-sm font-semibold text-orange-600">My Quotes</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(client)/product-orders')}>
            <Text className="text-sm font-semibold text-orange-600">My Orders</Text>
          </Pressable>
          {cartCount > 0 && (
            <Pressable
              onPress={() => router.push('/(client)/checkout')}
              className="rounded-full bg-orange-500 px-4 py-2"
            >
              <Text className="text-sm font-semibold text-white">Cart ({cartCount})</Text>
            </Pressable>
          )}
        </View>
      </View>

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
      {cartSellerId && (
        <Text className="mb-2 text-xs text-gray-400">
          Cart is limited to one seller at a time — clear it to buy from someone else.
        </Text>
      )}

      <View className="flex-row flex-wrap justify-between">
        {filtered.map((item) => (
          <ProductCard key={item.id} item={item} onAdd={handleAdd} />
        ))}
      </View>
    </ScrollView>
  );
}
