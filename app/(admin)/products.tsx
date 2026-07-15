// app/(admin)/products.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSupabaseQuery, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import type { Product } from '../../types/database.types';

function ProductRow({ product, sellerName }: { product: Product; sellerName: string }) {
  const deleteProduct = useSupabaseDelete('products');

  function confirmRemove() {
    showAlert('Remove this listing?', `"${product.name}" will be delisted from the marketplace.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          deleteProduct.mutate(product.id, { onError: (err) => showAlert('Could not remove', getErrorMessage(err)) }),
      },
    ]);
  }

  return (
    <View className="mb-2.5 rounded-xl border border-gray-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 font-semibold text-gray-900">{product.name}</Text>
        <Pressable onPress={confirmRemove} className="rounded-lg bg-red-50 px-3 py-1.5">
          <Text className="text-xs font-semibold text-red-700">Remove</Text>
        </Pressable>
      </View>
      <View className="mt-1 flex-row items-center gap-2">
        <Text className="text-xs text-gray-400">Seller: {sellerName}</Text>
        <View
          className={`rounded-full px-2 py-0.5 ${product.seller_role === 'wholesaler' ? 'bg-purple-50' : 'bg-orange-50'}`}
        >
          <Text
            className={`text-[10px] font-bold uppercase ${
              product.seller_role === 'wholesaler' ? 'text-purple-600' : 'text-orange-600'
            }`}
          >
            {product.seller_role}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-sm text-gray-600">
        NPR {Number(product.price).toLocaleString()} · {product.stock_level} in stock
        {product.wholesale_price != null && ` · Wholesale NPR ${Number(product.wholesale_price).toLocaleString()}`}
      </Text>
    </View>
  );
}

export default function AdminProducts() {
  const { data: products, isLoading } = useSupabaseQuery('products', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const { data: profiles } = useSupabaseQuery('profiles', {});

  const sellerMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p])), [profiles]);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">All Listings</Text>
      <Text className="mb-4 text-sm text-gray-500">
        Every product currently stocked by a wholesaler or reseller. New listings are self-service — manage what can
        be stocked from the Catalog tab.
      </Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && (products?.length ?? 0) === 0 && <Text className="text-gray-500">No listings yet.</Text>}

      {(products ?? []).map((item) => (
        <ProductRow key={item.id} product={item} sellerName={sellerMap.get(item.seller_id)?.full_name ?? 'Unknown'} />
      ))}
    </ScrollView>
  );
}
