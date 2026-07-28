// app/(client)/market.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useCartStore } from '../../lib/hooks/useCart';
import { SearchBar } from '../../lib/components/SearchBar';
import { SearchFilterSheet } from '../../lib/components/SearchFilterSheet';
import { CartBar } from '../../lib/components/CartBar';
import { showAlert } from '../../lib/utils/alert';
import { filterBySearch } from '../../lib/utils/search';
import type { Product } from '../../types/database.types';

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

  const cartItems = useCartStore((state) => state.items);
  const cartSellerId = useCartStore((state) => state.sellerId);
  const addToCart = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const { data: products, isLoading } = useSupabaseQuery('products', {
    filters: { seller_role: 'reseller' },
  });

  const inStockProducts = useMemo(
    () => (products ?? []).filter((p) => p.stock_level > 0 && p.is_listed !== false && Number(p.price) > 0),
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
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [inStockProducts, search, category]);

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

  function handleSearchChange(text: string) {
    setSearch(text);
    if (sheetOpen) setSheetOpen(false);
  }

  const cartTotal = cartItems.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1 bg-gray-50 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: cartCount > 0 ? 100 : 40 }}
        showsVerticalScrollIndicator={false}
      >
        {cartCount > 0 && (
          <View className="mb-4 flex-row items-center justify-end">
            <Pressable
              onPress={() => router.push('/(client)/checkout')}
              className="rounded-full bg-orange-500 px-4 py-2"
            >
              <Text className="text-sm font-semibold text-white">Cart ({cartCount})</Text>
            </Pressable>
          </View>
        )}

        <View className="mb-4">
          <SearchBar
            value={search}
            onChangeText={handleSearchChange}
            onOpenFilters={() => setSheetOpen(true)}
            filterActive={!!category}
            placeholder="Search by name or model…"
          />
        </View>

        <SearchFilterSheet
          visible={sheetOpen}
          category={category}
          categories={categories}
          onSelect={setCategory}
          onClose={() => setSheetOpen(false)}
        />

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

      <CartBar
        visible={cartCount > 0}
        itemCount={cartCount}
        total={cartTotal}
        onCheckout={() => router.push('/(client)/checkout')}
      />
    </View>
  );
}
