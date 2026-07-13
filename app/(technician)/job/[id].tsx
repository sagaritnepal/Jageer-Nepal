// app/(technician)/job/[id].tsx
import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseUpdate, useSupabaseInsert, useSupabaseQuery } from '../../../lib/hooks/useSupabase';
import { RequestDetailsExtras } from '../../../lib/components/RequestDetailsExtras';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import type { RequestStatus } from '../../../types/database.types';

const NEXT_STATUS: Partial<Record<RequestStatus, RequestStatus>> = {
  assigned: 'in_progress',
  in_progress: 'resolved',
};

const STATUS_ACTION_LABEL: Partial<Record<RequestStatus, string>> = {
  assigned: 'Start job',
  in_progress: 'Mark resolved',
};

interface PartRow {
  name: string;
  quantity: string;
  cost: string;
}

export default function JobCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: request, isLoading } = useSupabaseRow('service_requests', id);
  const { data: jobCards } = useSupabaseQuery('job_cards', {
    filters: id ? { service_request_id: id } : {},
    enabled: !!id,
  });
  const jobCard = jobCards?.[0] ?? null;
  const { data: customer } = useSupabaseRow('profiles', request?.client_id);

  const updateRequest = useSupabaseUpdate('service_requests');
  const insertJobCard = useSupabaseInsert('job_cards');
  const updateJobCard = useSupabaseUpdate('job_cards');

  const [parts, setParts] = useState<PartRow[]>([{ name: '', quantity: '1', cost: '0' }]);
  const [laborCost, setLaborCost] = useState('0');

  if (isLoading || !request) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const nextStatus = NEXT_STATUS[request.status];

  function updatePart(index: number, field: keyof PartRow, value: string) {
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPart() {
    setParts((prev) => [...prev, { name: '', quantity: '1', cost: '0' }]);
  }

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAdvance() {
    if (!userId || !nextStatus || !request) return;
    try {
      if (request.status === 'assigned') {
        // Opens a job card to track parts/labor against once work begins.
        await insertJobCard.mutateAsync({
          service_request_id: request.id,
          technician_id: userId,
          started_at: new Date().toISOString(),
        });
      } else if (request.status === 'in_progress') {
        const validParts = parts
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), quantity: Number(p.quantity) || 0, cost: Number(p.cost) || 0 }));
        const partsCost = validParts.reduce((sum, p) => sum + p.quantity * p.cost, 0);
        const values = {
          parts_used: validParts,
          labor_cost: Number(laborCost) || 0,
          parts_cost: partsCost,
          completed_at: new Date().toISOString(),
        };

        if (jobCard) {
          await updateJobCard.mutateAsync({ id: jobCard.id, values });
        } else {
          // No job card was opened (e.g. older data) - create one now.
          await insertJobCard.mutateAsync({ service_request_id: request.id, technician_id: userId, ...values });
        }
      }

      await updateRequest.mutateAsync({ id: request.id, values: { status: nextStatus } });
    } catch (err) {
      showAlert('Could not update job', getErrorMessage(err));
    }
  }

  const isSaving = updateRequest.isPending || insertJobCard.isPending || updateJobCard.isPending;

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-2 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-6 text-gray-600">{request.description}</Text>

      <View className="mb-6 rounded-xl bg-white p-5">
        <Text className="text-sm uppercase tracking-wide text-gray-400">Current status</Text>
        <Text className="mt-1 text-lg font-semibold capitalize text-blue-700">
          {request.status.replace('_', ' ')}
        </Text>
        {request.quoted_price != null && (
          <Text className="mt-2 text-sm text-gray-500">
            Quoted price: NPR {Number(request.quoted_price).toLocaleString()}
          </Text>
        )}
      </View>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name ?? customer?.full_name}
        customerPhone={request.customer_phone ?? customer?.phone}
      />

      {request.remark && (
        <View className="mb-6 mt-4 rounded-xl bg-white p-5">
          <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Remark</Text>
          <Text className="text-sm text-gray-700">{request.remark}</Text>
        </View>
      )}

      {request.status === 'in_progress' && (
        <View className="mb-6 rounded-xl bg-white p-5">
          <Text className="mb-3 text-sm font-semibold text-gray-900">Parts used</Text>
          {parts.map((part, index) => (
            <View key={index} className="mb-2 flex-row items-center gap-2">
              <TextInput
                value={part.name}
                onChangeText={(v) => updatePart(index, 'name', v)}
                placeholder="Part name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <TextInput
                value={part.quantity}
                onChangeText={(v) => updatePart(index, 'quantity', v)}
                placeholder="Qty"
                keyboardType="numeric"
                className="w-16 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <TextInput
                value={part.cost}
                onChangeText={(v) => updatePart(index, 'cost', v)}
                placeholder="Cost"
                keyboardType="numeric"
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <Pressable onPress={() => removePart(index)} className="items-center justify-center px-2 py-2">
                <Text className="text-red-600">✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addPart} className="mb-4 self-start">
            <Text className="text-sm font-semibold text-blue-700">+ Add part</Text>
          </Pressable>

          <Text className="mb-1 text-sm font-semibold text-gray-900">Labor cost (NPR)</Text>
          <TextInput
            value={laborCost}
            onChangeText={setLaborCost}
            keyboardType="numeric"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </View>
      )}

      {nextStatus && (
        <Pressable
          onPress={handleAdvance}
          disabled={isSaving}
          className="mb-4 items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-white">
            {isSaving ? 'Updating…' : STATUS_ACTION_LABEL[request.status]}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
