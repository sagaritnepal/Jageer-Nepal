// app/(client)/quote/[id].tsx
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSupabaseRow, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';

export default function ClientQuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading } = useSupabaseRow('product_quotes', id);
  const { data: product } = useSupabaseRow('products', quote?.product_id);
  const { data: reseller } = useSupabaseRow('profiles', quote?.reseller_id);
  const updateQuote = useSupabaseUpdate('product_quotes');

  if (isLoading || !quote) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  async function handleAccept() {
    try {
      await updateQuote.mutateAsync({ id: quote!.id, values: { status: 'accepted' } });
    } catch (err) {
      showAlert('Could not accept', getErrorMessage(err));
    }
  }

  async function handleDecline() {
    try {
      await updateQuote.mutateAsync({ id: quote!.id, values: { status: 'declined' } });
    } catch (err) {
      showAlert('Could not decline', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{product?.name ?? 'Quote request'}</Text>
      <Text className="mb-6 text-gray-600">Qty: {quote.quantity}</Text>

      {quote.message && (
        <View className="mb-4 rounded-xl bg-white p-5">
          <Text className="mb-1 text-sm uppercase tracking-wide text-gray-400">Your message</Text>
          <Text className="text-sm text-gray-700">{quote.message}</Text>
        </View>
      )}

      {quote.status === 'pending' && (
        <View className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-amber-600">Awaiting quote</Text>
          <Text className="mt-1 text-sm text-amber-700">
            {reseller?.full_name ?? 'The seller'} hasn't responded with a price yet.
          </Text>
        </View>
      )}

      {quote.status === 'quoted' && (
        <View className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-blue-600">Price quote</Text>
          <Text className="mt-1 text-2xl font-bold text-blue-800">
            NPR {Number(quote.quoted_price).toLocaleString()}
          </Text>
          <Text className="mt-2 text-sm text-blue-700">for {quote.quantity} unit(s)</Text>
          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={handleDecline}
              disabled={updateQuote.isPending}
              className="flex-1 items-center rounded-lg border border-blue-300 bg-white py-2.5 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-blue-700">Decline</Text>
            </Pressable>
            <Pressable
              onPress={handleAccept}
              disabled={updateQuote.isPending}
              className="flex-1 items-center rounded-lg bg-blue-700 py-2.5 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">
                {updateQuote.isPending ? 'Updating…' : 'Accept quote'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {quote.status === 'accepted' && (
        <View className="rounded-xl border border-green-200 bg-green-50 p-5">
          <Text className="text-sm uppercase tracking-wide text-green-600">Accepted</Text>
          <Text className="mt-1 text-sm text-green-700">
            {reseller?.full_name ?? 'The seller'} will contact you to arrange payment and delivery.
          </Text>
          {reseller?.phone && (
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => Linking.openURL(`sms:${reseller.phone}`)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2.5"
              >
                <Ionicons name="chatbubble-outline" size={15} color="#15803D" />
                <Text className="text-sm font-semibold text-green-700">Message</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`tel:${reseller.phone}`)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2.5"
              >
                <Ionicons name="call-outline" size={15} color="#15803D" />
                <Text className="text-sm font-semibold text-green-700">Call</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {quote.status === 'declined' && (
        <View className="rounded-xl border border-gray-200 bg-white p-5">
          <Text className="text-sm text-gray-500">This quote was declined.</Text>
        </View>
      )}
    </ScrollView>
  );
}
