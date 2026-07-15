// app/(admin)/catalog.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import type { CatalogProduct } from '../../types/database.types';

function CatalogRow({ item }: { item: CatalogProduct }) {
  const updateItem = useSupabaseUpdate('catalog_products');
  const deleteItem = useSupabaseDelete('catalog_products');

  function confirmRemove() {
    showAlert(
      'Remove this catalog item?',
      `"${item.name}" will be removed. This fails if a wholesaler or reseller is already stocking it — hide it instead in that case.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteItem.mutate(item.id, { onError: (err) => showAlert('Could not remove', getErrorMessage(err)) }),
        },
      ]
    );
  }

  return (
    <View
      className={`mb-2.5 flex-row items-center justify-between rounded-xl border bg-white p-4 ${
        item.is_active ? 'border-gray-200' : 'border-gray-200 opacity-50'
      }`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-lg">📦</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{item.name}</Text>
          {item.category && <Text className="mt-0.5 text-xs text-orange-600">{item.category}</Text>}
          {item.description && <Text className="mt-0.5 text-xs text-gray-400">{item.description}</Text>}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => updateItem.mutate({ id: item.id, values: { is_active: !item.is_active } })}
          disabled={updateItem.isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5"
        >
          <Text className="text-xs font-semibold text-gray-700">{item.is_active ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Pressable onPress={confirmRemove} className="rounded-lg bg-red-50 px-3 py-1.5">
          <Text className="text-xs font-semibold text-red-700">Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminCatalog() {
  const { data: items, isLoading } = useSupabaseQuery('catalog_products', {
    orderBy: { column: 'name' },
  });
  const insertItem = useSupabaseInsert('catalog_products');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  function resetForm() {
    setName('');
    setDescription('');
    setCategory('');
    setImageUrl('');
    setShowForm(false);
  }

  async function handleAdd() {
    if (!name.trim()) {
      showAlert('Add a name', 'Product name is required.');
      return;
    }
    try {
      await insertItem.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        image_url: imageUrl.trim() || null,
      });
      resetForm();
    } catch (err) {
      showAlert('Could not add catalog item', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Product Catalog</Text>
        <Pressable onPress={() => setShowForm((v) => !v)} className="rounded-lg bg-blue-700 px-4 py-2">
          <Text className="font-semibold text-white">{showForm ? 'Cancel' : '+ Add'}</Text>
        </Pressable>
      </View>
      <Text className="mb-4 text-sm text-gray-500">
        Templates only — no price here. Wholesalers and resellers set their own price and stock when they add an item
        from this catalog to their shop.
      </Text>

      {showForm && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">Product name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Samsung Galaxy A54 5G"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Text className="mb-1 text-sm font-medium text-gray-700">Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. 8GB/128GB, 5000mAh battery"
            multiline
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Text className="mb-1 text-sm font-medium text-gray-700">Category (optional)</Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Mobile Phones"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Text className="mb-1 text-sm font-medium text-gray-700">Image URL (optional)</Text>
          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            autoCapitalize="none"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Pressable
            onPress={handleAdd}
            disabled={insertItem.isPending}
            className="items-center rounded-lg bg-blue-700 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">
              {insertItem.isPending ? 'Adding…' : 'Add to catalog'}
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      {(items ?? []).map((item) => (
        <CatalogRow key={item.id} item={item} />
      ))}
    </ScrollView>
  );
}
