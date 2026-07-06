// app/(admin)/products.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Alert } from 'react-native';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import type { Product, Profile } from '../../types/database.types';

function ProductRow({ product, sellerName }: { product: Product; sellerName: string }) {
  const deleteProduct = useSupabaseDelete('products');

  function confirmRemove() {
    Alert.alert('Remove this listing?', `"${product.name}" will be delisted from the marketplace.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteProduct.mutate(product.id) },
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
      <Text className="mt-1 text-xs text-gray-400">Seller: {sellerName}</Text>
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
  const insertProduct = useSupabaseInsert('products');

  const sellers = useMemo(
    () => (profiles ?? []).filter((p) => p.role === 'reseller' || p.role === 'wholesaler'),
    [profiles]
  );
  const sellerMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p])), [profiles]);

  const [showForm, setShowForm] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');
  const [minOrderQty, setMinOrderQty] = useState('');

  const selectedSeller: Profile | undefined = sellers.find((s) => s.id === sellerId);

  function resetForm() {
    setSellerId(null);
    setName('');
    setCategory('');
    setPrice('');
    setWholesalePrice('');
    setStockLevel('');
    setMinOrderQty('');
    setShowForm(false);
  }

  async function handleAdd() {
    if (!sellerId) {
      Alert.alert('Choose a seller', 'Pick which reseller or wholesaler this product belongs to.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Add a name', 'Product name is required.');
      return;
    }
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Enter a valid price in NPR.');
      return;
    }
    const stockNum = parseInt(stockLevel, 10);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Invalid stock level', 'Enter a valid whole number.');
      return;
    }

    try {
      await insertProduct.mutateAsync({
        seller_id: sellerId,
        name: name.trim(),
        category: category.trim() || null,
        price: priceNum,
        wholesale_price: wholesalePrice.trim() ? parseFloat(wholesalePrice) : null,
        stock_level: stockNum,
        min_order_qty: minOrderQty.trim() ? parseInt(minOrderQty, 10) : 1,
      });
      resetForm();
    } catch (err) {
      Alert.alert('Could not add product', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Products</Text>
        <Pressable onPress={() => setShowForm((v) => !v)} className="rounded-lg bg-blue-700 px-4 py-2">
          <Text className="font-semibold text-white">{showForm ? 'Cancel' : '+ Add'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">Seller</Text>
          <Pressable
            onPress={() => setShowSellerMenu((v) => !v)}
            className="mb-1 flex-row items-center justify-between rounded-lg border border-gray-300 px-3 py-2"
          >
            <Text className="text-sm text-gray-900">
              {selectedSeller ? `${selectedSeller.full_name ?? 'Unnamed'} (${selectedSeller.role})` : 'Select a seller'}
            </Text>
            <Text className="text-gray-400">{showSellerMenu ? '▲' : '▼'}</Text>
          </Pressable>
          {showSellerMenu && (
            <View className="mb-3 rounded-lg border border-gray-200 bg-white">
              {sellers.length === 0 && (
                <Text className="px-3 py-2.5 text-sm text-gray-400">No resellers or wholesalers registered yet.</Text>
              )}
              {sellers.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSellerId(s.id);
                    setShowSellerMenu(false);
                  }}
                  className="px-3 py-2.5"
                >
                  <Text className={s.id === sellerId ? 'font-semibold text-blue-700' : 'text-gray-700'}>
                    {s.full_name ?? 'Unnamed'} ({s.role})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text className="mb-1 text-sm font-medium text-gray-700">Product name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. HP LaserJet Toner Cartridge"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Category (optional)</Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Printer supplies"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Price (NPR)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Wholesale price (optional)</Text>
          <TextInput
            value={wholesalePrice}
            onChangeText={setWholesalePrice}
            placeholder="Leave blank if not sold wholesale"
            keyboardType="decimal-pad"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Stock level</Text>
          <TextInput
            value={stockLevel}
            onChangeText={setStockLevel}
            placeholder="0"
            keyboardType="number-pad"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Minimum order quantity (wholesale)</Text>
          <TextInput
            value={minOrderQty}
            onChangeText={setMinOrderQty}
            placeholder="1"
            keyboardType="number-pad"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <Pressable
            onPress={handleAdd}
            disabled={insertProduct.isPending}
            className="items-center rounded-lg bg-blue-700 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">
              {insertProduct.isPending ? 'Adding…' : 'Add product'}
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductRow product={item} sellerName={sellerMap.get(item.seller_id)?.full_name ?? 'Unknown'} />
        )}
      />
    </View>
  );
}
