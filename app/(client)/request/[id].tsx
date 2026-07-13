// app/(client)/request/[id].tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSupabaseRow, useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useRealtimeSync } from '../../../lib/hooks/useSupabase';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { RequestDetailsExtras } from '../../../lib/components/RequestDetailsExtras';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import type { JobCard, ServiceRequest } from '../../../types/database.types';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending — awaiting a price quote',
  quoted: 'Quote sent — awaiting your approval',
  approved: 'Approved — awaiting technician assignment',
  assigned: 'Assigned — technician is on the way',
  in_progress: 'In progress — repair underway',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

function QuoteApproval({ request }: { request: ServiceRequest }) {
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleApprove() {
    try {
      await updateRequest.mutateAsync({ id: request.id, values: { status: 'approved' } });
    } catch (err) {
      showAlert('Could not approve', getErrorMessage(err));
    }
  }

  async function handleDecline() {
    try {
      await updateRequest.mutateAsync({ id: request.id, values: { status: 'cancelled' } });
    } catch (err) {
      showAlert('Could not decline', getErrorMessage(err));
    }
  }

  return (
    <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <Text className="text-sm uppercase tracking-wide text-amber-600">Price quote</Text>
      <Text className="mt-1 text-2xl font-bold text-amber-800">
        NPR {Number(request.quoted_price).toLocaleString()}
      </Text>
      <Text className="mt-2 text-sm text-amber-700">
        Approve to let the reseller assign a technician, or decline to cancel this request.
      </Text>
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={handleDecline}
          disabled={updateRequest.isPending}
          className="flex-1 items-center rounded-lg border border-amber-300 bg-white py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-amber-700">Decline</Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={updateRequest.isPending}
          className="flex-1 items-center rounded-lg bg-amber-600 py-2.5 disabled:opacity-50"
        >
          <Text className="text-sm font-semibold text-white">
            {updateRequest.isPending ? 'Updating…' : 'Approve quote'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function JobCardBreakdown({ jobCard }: { jobCard: JobCard }) {
  const total = Number(jobCard.labor_cost) + Number(jobCard.parts_cost);

  return (
    <View className="mt-4 rounded-xl bg-white p-5">
      <Text className="mb-3 text-sm uppercase tracking-wide text-gray-400">Job summary</Text>

      {jobCard.parts_used && jobCard.parts_used.length > 0 && (
        <View className="mb-3">
          {jobCard.parts_used.map((part, index) => (
            <View key={index} className="mb-1 flex-row justify-between">
              <Text className="text-sm text-gray-700">
                {part.name} × {part.quantity}
              </Text>
              <Text className="text-sm text-gray-700">NPR {(part.cost * part.quantity).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="mb-1 flex-row justify-between">
        <Text className="text-sm text-gray-500">Labor</Text>
        <Text className="text-sm text-gray-700">NPR {Number(jobCard.labor_cost).toLocaleString()}</Text>
      </View>

      <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-2">
        <Text className="font-semibold text-gray-900">Total</Text>
        <Text className="font-semibold text-gray-900">NPR {total.toLocaleString()}</Text>
      </View>
    </View>
  );
}

function RatingForm({
  serviceRequestId,
  technicianId,
  clientId,
}: {
  serviceRequestId: string;
  technicianId: string;
  clientId: string;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const insertReview = useSupabaseInsert('reviews');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    await insertReview.mutateAsync({
      service_request_id: serviceRequestId,
      technician_id: technicianId,
      client_id: clientId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View className="mt-4 rounded-xl bg-white p-5">
        <Text className="text-sm text-gray-500">Thanks for rating this technician!</Text>
      </View>
    );
  }

  return (
    <View className="mt-4 rounded-xl bg-white p-5">
      <Text className="mb-3 text-sm uppercase tracking-wide text-gray-400">Rate this technician</Text>
      <View className="mb-3 flex-row gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Text className={star <= rating ? 'text-2xl text-amber-500' : 'text-2xl text-gray-300'}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Leave a comment (optional)"
        multiline
        className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <Pressable
        onPress={handleSubmit}
        disabled={insertReview.isPending}
        className="items-center rounded-lg bg-blue-700 py-2.5 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-white">
          {insertReview.isPending ? 'Submitting…' : 'Submit rating'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: request, isLoading } = useSupabaseRow('service_requests', id);
  const { data: jobCards } = useSupabaseQuery('job_cards', {
    filters: id ? { service_request_id: id } : {},
    enabled: !!id && request?.status === 'resolved',
  });
  const { data: reviews } = useSupabaseQuery('reviews', {
    filters: id ? { service_request_id: id } : {},
    enabled: !!id && request?.status === 'resolved',
  });

  // Live-updates this screen whenever the technician changes the status.
  const startSync = useRealtimeSync('service_requests', `id=eq.${id}`, { client_id: request?.client_id ?? null });
  useEffect(() => {
    if (!id) return;
    return startSync();
  }, [id]);

  if (isLoading || !request) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-16" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-2 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-6 text-gray-600">{request.description}</Text>

      <View className="rounded-xl bg-white p-5">
        <Text className="text-sm uppercase tracking-wide text-gray-400">Status</Text>
        <Text className="mt-1 text-lg font-semibold text-blue-700">
          {STATUS_LABELS[request.status] ?? request.status}
        </Text>
        {request.quoted_price != null && (
          <Text className="mt-2 text-sm text-gray-500">
            Quoted price: NPR {Number(request.quoted_price).toLocaleString()}
          </Text>
        )}
        {request.status === 'resolved' && (
          <View className={`mt-3 self-start rounded-full px-3 py-1 ${request.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
            <Text className={`text-xs font-bold ${request.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'}`}>
              {request.payment_status === 'paid' ? 'Payment received' : 'Payment due to reseller'}
            </Text>
          </View>
        )}
      </View>

      {request.status === 'quoted' && <QuoteApproval request={request} />}

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
      />

      {request.remark && (
        <View className="mt-4 rounded-xl bg-white p-5">
          <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Reseller's remark</Text>
          <Text className="text-sm text-gray-700">{request.remark}</Text>
        </View>
      )}

      {request.status === 'resolved' && jobCards?.[0] && <JobCardBreakdown jobCard={jobCards[0]} />}

      {request.status === 'resolved' &&
        request.technician_id &&
        userId &&
        reviews &&
        reviews.length === 0 && (
          <RatingForm serviceRequestId={request.id} technicianId={request.technician_id} clientId={userId} />
        )}
    </ScrollView>
  );
}
