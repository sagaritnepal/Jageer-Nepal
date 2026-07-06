// app/(client)/new-request.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseInsert } from '../../lib/hooks/useSupabase';

const CATEGORIES = [
  'Computer',
  'Printer',
  'Laptop',
  'CCTV',
  'Intercom',
  'Electrical',
  'Doorlock',
  'AC',
  'Attendance',
  'Wifi/Router',
];

const SERVICE_ACTIONS = ['Repair', 'Installation'] as const;

export default function NewRequest() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const createRequest = useSupabaseInsert('service_requests');

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [action, setAction] = useState<(typeof SERVICE_ACTIONS)[number]>(SERVICE_ACTIONS[0]);
  const [description, setDescription] = useState('');

  async function handleSubmit() {
    if (!userId) return;
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
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Request a repair</Text>

      <Text className="mb-2 text-sm font-medium text-gray-700">What do you need help with?</Text>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={`rounded-full border px-4 py-2 ${
              category === c ? 'border-blue-700 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={category === c ? 'font-semibold text-blue-700' : 'text-gray-600'}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-sm font-medium text-gray-700">Repair or installation?</Text>
      <View className="mb-6 flex-row gap-2">
        {SERVICE_ACTIONS.map((a) => (
          <Pressable
            key={a}
            onPress={() => setAction(a)}
            className={`flex-1 items-center rounded-lg border py-3 ${
              action === a ? 'border-blue-700 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={action === a ? 'font-semibold text-blue-700' : 'text-gray-600'}>{a}</Text>
          </Pressable>
        ))}
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
        disabled={createRequest.isPending}
        className="items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {createRequest.isPending ? 'Submitting…' : 'Submit request'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
