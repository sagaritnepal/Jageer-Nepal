// app/(admin)/support.tsx
import { useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useSupabaseQuery, useSupabaseUpdate } from '../../lib/hooks/useSupabase';

export default function AdminSupport() {
  const { data: tickets, isLoading } = useSupabaseQuery('support_tickets', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const { data: profiles } = useSupabaseQuery('profiles', {});
  const updateTicket = useSupabaseUpdate('support_tickets');

  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p])), [profiles]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Support Tickets</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && tickets?.length === 0 && <Text className="text-gray-500">No tickets reported.</Text>}

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const reporter = profileMap.get(item.user_id);
          return (
            <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13.5px] font-bold text-gray-900">{item.subject}</Text>
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    item.status === 'open' ? 'bg-red-50' : 'bg-green-50'
                  }`}
                >
                  <Text
                    className={`text-[10.5px] font-bold ${
                      item.status === 'open' ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {item.status === 'open' ? 'Open' : 'Resolved'}
                  </Text>
                </View>
              </View>
              <Text className="mt-1.5 text-xs text-gray-400">
                {reporter?.full_name ?? 'Unknown user'} · {reporter?.role ?? ''}
              </Text>

              {item.status === 'open' && (
                <Pressable
                  onPress={() => updateTicket.mutate({ id: item.id, values: { status: 'resolved' } })}
                  disabled={updateTicket.isPending}
                  className="mt-3 items-center rounded-lg border border-gray-300 py-2 disabled:opacity-50"
                >
                  <Text className="text-sm font-semibold text-gray-700">Mark resolved</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
