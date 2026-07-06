// app/(reseller)/add-product.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert } from '../../lib/hooks/useSupabase';

export default function AddProduct() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const createProduct = useSupabaseInsert('products');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');

  async function handleSubmit() {
    if (!userId) return;

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stockLevel, 10);

    if (!name.trim()) {
      Alert.alert('Add a name', 'Product name is required.');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Enter a valid price in NPR.');
      return;
    }
    if (Number.isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Invalid stock level', 'Enter a valid whole number.');
      return;
    }

    try {
      await createProduct.mutateAsync({
        seller_id: userId,
        name: name.trim(),
        category: category.trim() || null,
        price: priceNum,
        stock_level: stockNum,
      });
      Alert.alert('Product added', `${name} is now listed in your inventory.`);
      router.replace('/(reseller)/shop');
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Add product</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Product name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. HP LaserJet Toner Cartridge"
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Category (optional)</Text>
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Printer supplies"
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Price (NPR)</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder="0.00"
        keyboardType="decimal-pad"
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Stock level</Text>
      <TextInput
        value={stockLevel}
        onChangeText={setStockLevel}
        placeholder="0"
        keyboardType="number-pad"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={createProduct.isPending}
        className="items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {createProduct.isPending ? 'Adding…' : 'Add product'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
