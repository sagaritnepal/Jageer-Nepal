// app/(admin)/catalog.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import type { CatalogProduct } from '../../types/database.types';

async function pickAndUploadCatalogImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showAlert('Photo access needed', 'Allow photo library access to upload a product photo.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;

  const arraybuffer = await fetch(result.assets[0].uri).then((res) => res.arrayBuffer());
  const path = `catalog/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('catalog-images')
    .upload(path, arraybuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

function CatalogRow({ item }: { item: CatalogProduct }) {
  const updateItem = useSupabaseUpdate('catalog_products');
  const deleteItem = useSupabaseDelete('catalog_products');
  const [uploading, setUploading] = useState(false);

  async function handleReplacePhoto() {
    setUploading(true);
    try {
      const image_url = await pickAndUploadCatalogImage();
      if (image_url) {
        await updateItem.mutateAsync({ id: item.id, values: { image_url } });
      }
    } catch (err) {
      showAlert('Could not update photo', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

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
        <Pressable
          onPress={handleReplacePhoto}
          disabled={uploading}
          className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={16} color="#9CA3AF" />
          )}
        </Pressable>
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
  const [uploadingNew, setUploadingNew] = useState(false);

  function resetForm() {
    setName('');
    setDescription('');
    setCategory('');
    setImageUrl('');
    setShowForm(false);
  }

  async function handlePickNewImage() {
    setUploadingNew(true);
    try {
      const url = await pickAndUploadCatalogImage();
      if (url) setImageUrl(url);
    } catch (err) {
      showAlert('Could not upload photo', getErrorMessage(err));
    } finally {
      setUploadingNew(false);
    }
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
          <Text className="mb-1 text-sm font-medium text-gray-700">Photo (optional)</Text>
          <Pressable
            onPress={handlePickNewImage}
            disabled={uploadingNew}
            className="mb-3 h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-gray-50"
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Ionicons name={uploadingNew ? 'hourglass-outline' : 'camera'} size={22} color="#9CA3AF" />
            )}
          </Pressable>
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
