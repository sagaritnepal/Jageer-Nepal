// app/(client)/quotes.tsx
import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { QUOTE_STATUS_STYLES } from '../../lib/constants/quoteStatus';
import type { ProductQuote, QuoteStatus } from '../../types/database.types';

type ViewMode = 'active' | 'history';

const ACTIVE_STATUSES: QuoteStatus[] = ['pending', 'quoted'];

function StatusPill({ status }: { status: QuoteStatus }) {
  const style = QUOTE_STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function ClientQuoteCard({ item }: { item: ProductQuote }) {
  const { data: product } = useSupabaseRow('products', item.product_id);

  return (
    <Pressable
      onPress={() => router.push(`/(client)/quote/${item.id}`)}
      className="mb-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-semibold text-gray-900">{product?.name ?? 'Product'}</Text>
        <StatusPill status={item.status} />
      </View>
      <Text className="mt-1 text-xs text-gray-500">Qty: {item.quantity}</Text>
      {item.quoted_price != null && (
        <Text className="mt-1 text-sm font-semibold text-blue-700">
          NPR {Number(item.quoted_price).toLocaleString()}
        </Text>
      )}
      {item.message && (
        <Text className="mt-1 text-xs italic text-gray-400" numberOfLines={2}>
          "{item.message}"
        </Text>
      )}
    </Pressable>
  );
}

export default function ClientQuotes() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  const { data: quotes, isLoading } = useSupabaseQuery('product_quotes', {
    filters: userId ? { client_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    const list = quotes ?? [];
    return viewMode === 'active'
      ? list.filter((q) => ACTIVE_STATUSES.includes(q.status))
      : list.filter((q) => !ACTIVE_STATUSES.includes(q.status));
  }, [quotes, viewMode]);

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="mb-6 text-2xl font-bold text-gray-900">My Quotes</Text>

      <View className="mb-4 flex-row rounded-lg border border-gray-300 bg-white p-1">
        <Pressable
          onPress={() => setViewMode('active')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'active' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'active' ? 'text-white' : 'text-gray-600'}`}>
            Active
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('history')}
          className={`flex-1 items-center rounded-md py-2 ${viewMode === 'history' ? 'bg-blue-700' : ''}`}
        >
          <Text className={`text-sm font-semibold ${viewMode === 'history' ? 'text-white' : 'text-gray-600'}`}>
            History
          </Text>
        </Pressable>
      </View>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && filtered.length === 0 && (
        <Text className="text-gray-500">{viewMode === 'active' ? 'No active quotes.' : 'No past quotes yet.'}</Text>
      )}

      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <ClientQuoteCard item={item} />} />
    </View>
  );
}
