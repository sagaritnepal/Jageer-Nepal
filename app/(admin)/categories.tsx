// app/(admin)/categories.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '../../lib/hooks/useSupabase';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { resolveVisualKey } from '../../lib/constants/categoryIcons';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import type { ServiceCategory } from '../../types/database.types';

function CategoryRow({ category }: { category: ServiceCategory }) {
  const updateCategory = useSupabaseUpdate('service_categories');
  const deleteCategory = useSupabaseDelete('service_categories');
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(category.label);
  const [description, setDescription] = useState(category.description ?? '');
  const [icon, setIcon] = useState(category.icon ?? '');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setLabel(category.label);
    setDescription(category.description ?? '');
    setIcon(category.icon ?? '');
    setEditing(true);
  }

  async function handleSave() {
    if (!label.trim()) {
      showAlert('Add a name', 'Category name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        values: { label: label.trim(), description: description.trim() || null, icon: icon.trim() || null },
      });
      setEditing(false);
    } catch (err) {
      showAlert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    showAlert('Remove this category?', `"${category.label}" will no longer appear in the client app.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteCategory.mutate(category.id) },
    ]);
  }

  if (editing) {
    return (
      <View className="mb-2.5 rounded-xl border border-blue-300 bg-white p-4">
        <Text className="mb-1 text-xs font-medium text-gray-500">Name</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Home Automation"
          className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Text className="mb-1 text-xs font-medium text-gray-500">Subtitle (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Smart devices & setup"
          className="mb-2.5 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Text className="mb-1 text-xs font-medium text-gray-500">Icon (emoji, optional)</Text>
        <TextInput
          value={icon}
          onChangeText={setIcon}
          placeholder="🏠"
          className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <View className="flex-row gap-2">
          <Pressable onPress={() => setEditing(false)} className="flex-1 items-center rounded-lg border border-gray-300 py-2">
            <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-1 items-center rounded-lg bg-orange-500 py-2 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`mb-2.5 flex-row items-center justify-between rounded-xl border bg-white p-4 ${
        category.is_active ? 'border-gray-200' : 'border-gray-200 opacity-50'
      }`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        <CategoryBadge
          category={category.label}
          emoji={category.icon}
          categoryId={category.id}
          visualKey={category.visual_key}
          size={40}
        />
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{category.label}</Text>
          {category.description && <Text className="mt-0.5 text-xs text-gray-400">{category.description}</Text>}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable onPress={startEditing} hitSlop={8}>
          <Ionicons name="pencil" size={16} color="#2563eb" />
        </Pressable>
        <Pressable
          onPress={() => updateCategory.mutate({ id: category.id, values: { is_active: !category.is_active } })}
          disabled={updateCategory.isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5"
        >
          <Text className="text-xs font-semibold text-gray-700">{category.is_active ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Pressable onPress={confirmRemove} className="rounded-lg bg-red-50 px-3 py-1.5">
          <Text className="text-xs font-semibold text-red-700">Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminCategories() {
  const { data: categories, isLoading } = useSupabaseQuery('service_categories', {
    orderBy: { column: 'sort_order' },
  });
  const insertCategory = useSupabaseInsert('service_categories');

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');

  async function handleAdd() {
    if (!label.trim()) {
      showAlert('Add a name', 'Category name is required.');
      return;
    }
    try {
      await insertCategory.mutateAsync({
        label: label.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        visual_key: resolveVisualKey(label.trim()),
        sort_order: categories?.length ?? 0,
      });
      setLabel('');
      setDescription('');
      setIcon('');
      setShowForm(false);
    } catch (err) {
      showAlert('Could not add category', getErrorMessage(err));
    }
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-4 flex-row items-center justify-end">
        <Pressable onPress={() => setShowForm((v) => !v)} className="rounded-lg bg-orange-500 px-4 py-2">
          <Text className="font-semibold text-white">{showForm ? 'Cancel' : '+ Add'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">Name</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Home Automation"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Text className="mb-1 text-sm font-medium text-gray-700">Subtitle (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Smart devices & setup"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Text className="mb-1 text-sm font-medium text-gray-700">Icon (emoji, optional)</Text>
          <TextInput
            value={icon}
            onChangeText={setIcon}
            placeholder="🏠"
            className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Pressable
            onPress={handleAdd}
            disabled={insertCategory.isPending}
            className="items-center rounded-lg bg-orange-500 py-2.5 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">
              {insertCategory.isPending ? 'Adding…' : 'Add category'}
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading && <Text className="text-gray-500">Loading…</Text>}

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CategoryRow category={item} />}
      />
    </View>
  );
}
