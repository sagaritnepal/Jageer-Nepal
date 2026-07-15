// lib/components/CatalogStockingList.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image } from 'react-native';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery, useSupabaseUpsert } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';
import type { CatalogProduct, Product } from '../../types/database.types';

function StockRow({
  item,
  existing,
  priceLabel,
  userId,
}: {
  item: CatalogProduct;
  existing: Product | undefined;
  priceLabel: string;
  userId: string;
}) {
  const upsertProduct = useSupabaseUpsert('products', 'seller_id,catalog_id');
  const [qty, setQty] = useState(existing?.stock_level ?? 0);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [saving, setSaving] = useState(false);

  const isStocked = !!existing;
  const dirty = qty !== (existing?.stock_level ?? 0) || price !== (existing ? String(existing.price) : '');

  async function handleSave() {
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

      <View className="mt-3 flex-row items-center gap-2">
        <View className="flex-row items-center rounded-lg border border-gray-300">
          <Pressable onPress={() => setQty((q) => Math.max(0, q - 1))} className="px-3 py-2">
            <Text className="text-lg text-gray-500">−</Text>
          </Pressable>
          <Text className="w-10 text-center text-sm font-semibold text-gray-900">{qty}</Text>
          <Pressable onPress={() => setQty((q) => q + 1)} className="px-3 py-2">
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
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900"
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty}
          className="items-center rounded-lg bg-orange-500 px-3 py-2.5 disabled:opacity-40"
        >
          <Text className="text-xs font-semibold text-white">{saving ? 'Saving…' : isStocked ? 'Update' : 'Add'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CatalogStockingList({ priceLabel }: { priceLabel: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);

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

  const isLoading = loadingCatalog || loadingMine;

  if (!userId) return null;

  return (
    <View>
      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && (catalog?.length ?? 0) === 0 && (
        <Text className="text-gray-500">No catalog items available yet — check back soon.</Text>
      )}
      <FlatList
        data={catalog}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StockRow item={item} existing={myProductByCatalogId.get(item.id)} priceLabel={priceLabel} userId={userId} />
        )}
      />
    </View>
  );
}
