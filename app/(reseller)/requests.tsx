// app/(reseller)/requests.tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';

type ViewMode = 'incoming' | 'mine';

export default function ResellerRequestQueue() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [viewMode, setViewMode] = useState<ViewMode>('incoming');

  const { data: incoming, isLoading: loadingIncoming } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    orderBy: { column: 'created_at', ascending: true },
    enabled: viewMode === 'incoming',
  });

  const { data: mine, isLoading: loadingMine } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: viewMode === 'mine' && !!userId,
  });

  const requests = viewMode === 'incoming' ? incoming : mine;
  const isLoading = viewMode === 'incoming' ? loadingIncoming : loadingMine;

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-4 text-2xl font-bold text-gray-900">Request Queue</Text>

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setViewMode('incoming')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'incoming' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'incoming' ? 'text-white' : 'text-gray-600'}`}>
            Incoming
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('mine')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'mine' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'mine' ? 'text-white' : 'text-gray-600'}`}>
            My Jobs
          </Text>
        </Pressable>
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && requests?.length === 0 && (
        <Text className="text-gray-500">
          {viewMode === 'incoming' ? 'No pending requests right now.' : "You haven't taken on any jobs yet."}
        </Text>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(reseller)/request/${item.id}`)}
            className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Text className="font-semibold text-gray-900">{item.issue_type}</Text>
            <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
              {item.description}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Text className="text-xs uppercase tracking-wide text-amber-600">
                {viewMode === 'incoming' ? 'Pending — needs a technician' : item.status.replace('_', ' ')}
              </Text>
              {viewMode === 'mine' && (
                <>
                  <View className={`rounded-full px-2 py-0.5 ${item.origin === 'app' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                    <Text
                      className={`text-[10px] font-semibold ${
                        item.origin === 'app' ? 'text-blue-700' : 'text-purple-700'
                      }`}
                    >
                      {item.origin === 'app' ? 'App customer' : 'Your customer'}
                    </Text>
                  </View>
                  <View className={`rounded-full px-2 py-0.5 ${item.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
                    <Text
                      className={`text-[10px] font-semibold ${
                        item.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
