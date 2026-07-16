// app/(reseller)/quote/[id].tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSupabaseRow, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import type { Product, ProductQuote, Profile } from '../../../types/database.types';

function SendQuote({ quote, product, client }: { quote: ProductQuote; product: Product; client: Profile | null }) {
  const [price, setPrice] = useState('');
  const updateQuote = useSupabaseUpdate('product_quotes');

  async function handleSend() {
    const priceNum = Number(price);
    if (!price.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      showAlert('Add a price', 'Enter what you\'d charge this customer.');
      return;
    }
    try {
      await updateQuote.mutateAsync({ id: quote.id, values: { quoted_price: priceNum, status: 'quoted' } });
      showAlert('Quote sent', 'Waiting for the customer to respond.');
      router.replace('/(reseller)/quotes');
    } catch (err) {
      showAlert('Could not send quote', getErrorMessage(err));
    }
  }

  async function handleDecline() {
    try {
      await updateQuote.mutateAsync({ id: quote.id, values: { status: 'declined' } });
      router.replace('/(reseller)/quotes');
    } catch (err) {
      showAlert('Could not decline', getErrorMessage(err));
    }
  }

  return (
    <>
      <View className="rounded-xl bg-white p-5">
        <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Customer</Text>
        <Text className="text-sm font-semibold text-gray-900">{client?.full_name ?? 'Customer'}</Text>
        {client?.phone && <Text className="mt-0.5 text-sm text-gray-500">{client.phone}</Text>}
        <Text className="mt-3 text-xs text-gray-400">Requested qty: {quote.quantity}</Text>
        {quote.message && <Text className="mt-2 text-sm text-gray-700">"{quote.message}"</Text>}
        <Text className="mt-3 text-xs text-gray-400">Your listed price: NPR {Number(product.price).toLocaleString()}</Text>
      </View>

      <Text className="mb-1 mt-6 text-sm font-medium text-gray-700">Your price (NPR)</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder={String(product.price)}
        keyboardType="numeric"
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
      />

      <View className="flex-row gap-2">
        <Pressable
          onPress={handleDecline}
          disabled={updateQuote.isPending}
          className="flex-1 items-center rounded-lg border border-gray-300 py-3 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-gray-600">Can't fulfill</Text>
        </Pressable>
        <Pressable
          onPress={handleSend}
          disabled={updateQuote.isPending}
          className="flex-1 items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">
            {updateQuote.isPending ? 'Sending…' : 'Send quote'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function WaitingForApproval({ quote }: { quote: ProductQuote }) {
  return (
    <View className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <Text className="text-sm uppercase tracking-wide text-amber-600">Awaiting customer approval</Text>
      <Text className="mt-1 text-lg font-semibold text-amber-800">
        Quoted NPR {Number(quote.quoted_price).toLocaleString()}
      </Text>
      <Text className="mt-2 text-sm text-amber-700">
        You'll be notified once the customer accepts or declines this price.
      </Text>
    </View>
  );
}

function AcceptedContact({ client }: { client: Profile | null }) {
  return (
    <View className="rounded-xl border border-green-200 bg-green-50 p-5">
      <Text className="text-sm uppercase tracking-wide text-green-600">Accepted</Text>
      <Text className="mt-1 text-sm text-green-700">Reach out to arrange payment and delivery.</Text>
      {client?.phone && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => Linking.openURL(`sms:${client.phone}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2.5"
          >
            <Ionicons name="chatbubble-outline" size={15} color="#15803D" />
            <Text className="text-sm font-semibold text-green-700">Message</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(`tel:${client.phone}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2.5"
          >
            <Ionicons name="call-outline" size={15} color="#15803D" />
            <Text className="text-sm font-semibold text-green-700">Call</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function ResellerQuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading } = useSupabaseRow('product_quotes', id);
  const { data: product } = useSupabaseRow('products', quote?.product_id);
  const { data: client } = useSupabaseRow('profiles', quote?.client_id);

  if (isLoading || !quote || !product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{product.name}</Text>
      <Text className="mb-6 text-gray-600">Quote request</Text>

      {quote.status === 'pending' && <SendQuote quote={quote} product={product} client={client ?? null} />}
      {quote.status === 'quoted' && <WaitingForApproval quote={quote} />}
      {quote.status === 'accepted' && <AcceptedContact client={client ?? null} />}
      {quote.status === 'declined' && (
        <View className="rounded-xl border border-gray-200 bg-white p-5">
          <Text className="text-sm text-gray-500">This quote is closed.</Text>
        </View>
      )}
    </ScrollView>
  );
}
