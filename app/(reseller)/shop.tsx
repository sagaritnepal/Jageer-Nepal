// app/(reseller)/shop.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useCartStore } from '../../lib/hooks/useCart';
import { CatalogStockingList } from '../../lib/components/CatalogStockingList';
import { showAlert } from '../../lib/utils/alert';
import type { Product } from '../../types/database.types';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';
type ViewMode = 'wholesale' | 'products' | 'storefront';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  name: 'Name',
};

function ProductCard({ item, onAdd }: { item: Product; onAdd: (product: Product) => void }) {
  const outOfStock = item.stock_level <= 0;

  return (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3">
      <Pressable onPress={() => router.push(`/(reseller)/product/${item.id}`)}>
        <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-3xl">🖥️</Text>
          )}
          {item.is_dead_stock && (
            <View className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-white">Dead stock</Text>
            </View>
          )}
          {outOfStock && (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <Text className="text-xs font-bold text-white">OUT OF STOCK</Text>
            </View>
          )}
        </View>

        {item.category && (
          <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
        )}
        <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-base font-bold text-gray-900">
          NPR {Number(item.price).toLocaleString()}
        </Text>
        <Text className="mb-2 mt-0.5 text-xs text-gray-400">
          {outOfStock ? 'Out of stock' : `${item.stock_level} in stock`}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onAdd(item)}
        disabled={outOfStock}
        className="items-center rounded-lg bg-orange-500 py-2 disabled:opacity-40"
      >
        <Text className="text-xs font-semibold text-white">Add to Cart</Text>
      </Pressable>
    </View>
  );
}

function MyListings() {
  return (
    <>
      <Text className="mb-4 text-sm text-gray-500">
        Set quantity and your price for anything you carry — customers buy from you at this price.
      </Text>
      <CatalogStockingList priceLabel="Your price to customers" />
    </>
  );
}

function StorefrontCard({ item }: { item: Product }) {
  const outOfStock = item.stock_level <= 0;

  return (
    <View className="mb-4 w-[48%] rounded-xl border border-gray-200 bg-white p-3">
      <View className="mb-2 aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-3xl">🖥️</Text>
        )}
        {outOfStock && (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <Text className="text-xs font-bold text-white">OUT OF STOCK</Text>
          </View>
        )}
      </View>

      {item.category && (
        <Text className="mb-0.5 text-[11px] uppercase tracking-wide text-orange-600">{item.category}</Text>
      )}
      <Text className="mb-1 text-sm font-semibold text-gray-900" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="text-base font-bold text-gray-900">NPR {Number(item.price).toLocaleString()}</Text>
      <Text className="mt-0.5 text-xs text-gray-400">
        {outOfStock ? 'Out of stock' : `${item.stock_level} in stock`}
      </Text>
    </View>
  );
}

function MyStorefront() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: products, isLoading } = useSupabaseQuery('products', {
    filters: { seller_id: userId ?? '', seller_role: 'reseller' },
    enabled: !!userId,
  });

  const listed = products ?? [];

  return (
    <>
      <Text className="mb-4 text-sm text-gray-500">
        This is exactly what customers see when they browse your shop in the Marketplace — including anything out
        of stock. Go to Products to change what's listed here.
      </Text>
      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && listed.length === 0 && (
        <Text className="text-gray-500">Nothing listed yet — add items from the Products tab to appear here.</Text>
      )}
      <View className="flex-row flex-wrap justify-between">
        {listed.map((item) => (
          <StorefrontCard key={item.id} item={item} />
        ))}
      </View>
    </>
  );
}

export default function Shop() {
  const [viewMode, setViewMode] = useState<ViewMode>('wholesale');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const cartItems = useCartStore((state) => state.items);
  const cartSellerId = useCartStore((state) => state.sellerId);
  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const { data: products, isLoading } = useSupabaseQuery('products', {});
  const marketplaceProducts = useMemo(
    () => (products ?? []).filter((p) => p.seller_role === 'wholesaler'),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    marketplaceProducts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [marketplaceProducts]);

  const filtered = useMemo(() => {
    let list = marketplaceProducts;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
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
  }, [marketplaceProducts, search, category, sortBy]);

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

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Shop</Text>
        {viewMode === 'wholesale' && cartCount > 0 && (
          <Pressable
            onPress={() => router.push('/(reseller)/checkout')}
            className="rounded-full bg-orange-500 px-4 py-2"
          >
            <Text className="text-sm font-semibold text-white">Cart ({cartCount})</Text>
          </Pressable>
        )}
      </View>

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setViewMode('wholesale')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'wholesale' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'wholesale' ? 'text-white' : 'text-gray-600'}`}>
            Wholesale
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('products')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'products' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'products' ? 'text-white' : 'text-gray-600'}`}>
            Products
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('storefront')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'storefront' ? 'bg-orange-500' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'storefront' ? 'text-white' : 'text-gray-600'}`}>
            Marketplace
          </Text>
        </Pressable>
      </View>

      {viewMode === 'products' ? (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <MyListings />
        </ScrollView>
      ) : viewMode === 'storefront' ? (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <MyStorefront />
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="mb-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search hardware & spare parts…"
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 text-sm text-gray-900"
            />
          </View>

          {categories.length > 0 && (
            <View className="mb-3 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setCategory(null)}
                className={`rounded-full border px-3 py-1.5 ${
                  category === null ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-white'
                }`}
              >
                <Text className={category === null ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-600'}>
                  All
                </Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 ${
                    category === c ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  <Text className={category === c ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-600'}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

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
            <Text className="text-gray-500">No products match your search.</Text>
          )}
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
      )}
    </View>
  );
}
