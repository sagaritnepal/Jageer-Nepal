// app/(client)/new-request.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert, useSupabaseQuery } from '../../lib/hooks/useSupabase';

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

export default function NewRequest() {
  const { category: presetCategory } = useLocalSearchParams<{ category?: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const createRequest = useSupabaseInsert('service_requests');

  const { data: categories, isLoading: loadingCategories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
  });

  const [categoryOverride, setCategoryOverride] = useState<string | null>(presetCategory ?? null);
  const category = categoryOverride ?? categories?.[0]?.label ?? null;
  const [action, setAction] = useState<(typeof SERVICE_ACTIONS)[number]>(SERVICE_ACTIONS[0]);
  const [description, setDescription] = useState('');

  async function handleSubmit() {
    if (!userId) {
      Alert.alert('Please sign in', 'Your session may have expired — sign in again and retry.');
      return;
    }
    if (!category) {
      Alert.alert('Choose a category', 'Pick what you need help with before submitting.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Add a description', 'Let us know a bit more about the issue.');
      return;
    }

    try {
      await createRequest.mutateAsync({
        client_id: userId,
        issue_type: `${category} - ${action}`,
        description: description.trim(),
        status: 'pending',
      });
      Alert.alert('Request submitted', 'A technician will be assigned soon.');
      router.replace('/(client)/requests');
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 100 }}>
      <Text className="mb-6 text-2xl font-bold text-gray-900">Request a repair</Text>

      <Text className="mb-2 text-sm font-medium text-gray-700">What do you need help with?</Text>
      {loadingCategories && <Text className="mb-4 text-gray-500">Loading categories…</Text>}
      <View className="mb-6 flex-row flex-wrap justify-between">
        {(categories ?? []).map((c) => {
          const isSelected = category === c.label;
          return (
            <View
              key={c.id}
              className={`mb-2.5 w-[48%] rounded-2xl border p-3.5 ${
                isSelected ? 'border-blue-700 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <Pressable onPress={() => setCategoryOverride(c.label)}>
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  }`}
                >
                  <Text className="text-base">{c.icon}</Text>
                </View>
                <Text
                  className={`mt-2 text-[13px] font-bold leading-[1.25] ${
                    isSelected ? 'text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {c.label}
                </Text>
                {c.description && <Text className="mt-0.5 text-[11px] text-gray-400">{c.description}</Text>}
              </Pressable>

              {isSelected && (
                <View className="mt-3 flex-row gap-1.5">
                  {SERVICE_ACTIONS.map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => setAction(a)}
                      className={`flex-1 items-center rounded-lg border py-1.5 ${
                        action === a ? 'border-blue-700 bg-blue-700' : 'border-gray-300 bg-white'
                      }`}
                    >
                      <Text className={`text-[11px] font-semibold ${action === a ? 'text-white' : 'text-gray-600'}`}>
                        {a}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text className="mb-2 text-sm font-medium text-gray-700">Describe the problem</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Laptop won't turn on, screen is cracked, etc."
        multiline
        numberOfLines={4}
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={createRequest.isPending || !category}
        className="items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {createRequest.isPending ? 'Submitting…' : 'Submit request'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
