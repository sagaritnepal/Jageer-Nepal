// app/(reseller)/request/[id].tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../../lib/hooks/useAuth';
import { useSupabaseRow, useSupabaseUpdate } from '../../../lib/hooks/useSupabase';
import { useRankedTechnicians } from '../../../lib/hooks/useTechnicianRanking';
import { RequestDetailsExtras } from '../../../lib/components/RequestDetailsExtras';
import { TechnicianPicker } from '../../../lib/components/TechnicianPicker';
import { getCategoryVisual } from '../../../lib/constants/categoryIcons';
import { showAlert, getErrorMessage } from '../../../lib/utils/alert';
import type { ServiceRequest } from '../../../types/database.types';

function RemarkBlock({ remark }: { remark: string | null }) {
  if (!remark) return null;
  return (
    <View className="mt-4 rounded-xl bg-white p-5">
      <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Remark</Text>
      <Text className="text-sm text-gray-700">{remark}</Text>
    </View>
  );
}

function JobTracking({ request }: { request: ServiceRequest }) {
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleMarkPaid() {
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        values: { payment_status: 'paid', paid_at: new Date().toISOString() },
      });
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <View className="rounded-xl bg-white p-5">
        <Text className="text-sm uppercase tracking-wide text-gray-400">Status</Text>
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
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <RemarkBlock remark={request.remark} />

      <View className="mt-4 rounded-xl bg-white p-5">
        <Text className="mb-2 text-sm uppercase tracking-wide text-gray-400">Payment</Text>
        <Text className="mb-3 text-sm text-gray-600">
          The client pays you directly — mark this paid once you've collected it.
        </Text>
        <View className="flex-row items-center justify-between">
          <View className={`rounded-full px-3 py-1.5 ${request.payment_status === 'paid' ? 'bg-green-100' : 'bg-red-50'}`}>
            <Text
              className={`text-xs font-bold ${
                request.payment_status === 'paid' ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {request.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
          {request.payment_status !== 'paid' && request.status === 'resolved' && (
            <Pressable
              onPress={handleMarkPaid}
              disabled={updateRequest.isPending}
              className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-white">
                {updateRequest.isPending ? 'Updating…' : 'Mark as paid'}
              </Text>
            </Pressable>
          )}
        </View>
        {request.payment_status !== 'paid' && request.status !== 'resolved' && (
          <Text className="mt-2 text-xs text-gray-400">
            You can mark this as paid once the technician resolves the job.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

// Reseller brought in their own (offline) customer - they've already agreed
// on the job and price directly, so there's no app-side customer to approve
// anything. Price and technician assignment happen together in one step.
function SelfSourcedAssign({ request, userId }: { request: ServiceRequest; userId: string }) {
  const [quotedPrice, setQuotedPrice] = useState(
    request.quoted_price != null ? String(request.quoted_price) : ''
  );
  const { rankedTechnicians, isLoading: loadingTechs } = useRankedTechnicians(request.location_data);
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleAssign(technicianId: string) {
    const price = quotedPrice.trim() ? Number(quotedPrice) : null;
    if (price != null && (Number.isNaN(price) || price <= 0)) {
      showAlert('Invalid price', 'Enter a valid price in NPR, or leave it blank.');
      return;
    }
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        values: { technician_id: technicianId, status: 'assigned', quoted_price: price, reseller_id: userId },
      });
      showAlert('Technician assigned', 'The job has been handed off.');
      router.replace('/(reseller)/requests');
    } catch (err) {
      showAlert('Could not assign', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <Text className="mb-1 mt-6 text-sm font-medium text-gray-700">Quoted price (NPR, optional)</Text>
      <TextInput
        value={quotedPrice}
        onChangeText={setQuotedPrice}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
      />

      <TechnicianPicker
        technicians={rankedTechnicians}
        isLoading={loadingTechs}
        locationKnown={request.location_data?.latitude != null}
        onAssign={handleAssign}
        disabled={updateRequest.isPending}
      />
    </ScrollView>
  );
}

// Any reseller can see this pending app request in their Incoming queue, so
// customer contact stays hidden until one of them claims it - claiming just
// stamps reseller_id, which is enough to pull it into that reseller's My
// Jobs tab and drop it out of everyone else's Incoming queue.
function AcceptIncomingRequest({ request, userId }: { request: ServiceRequest; userId: string }) {
  const updateRequest = useSupabaseUpdate('service_requests');
  const { bg: categoryBg, icon: categoryIcon } = getCategoryVisual(request.issue_type);

  async function handleAccept() {
    try {
      await updateRequest.mutateAsync({ id: request.id, values: { reseller_id: userId } });
    } catch (err) {
      showAlert('Could not accept job', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mb-4 flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-2xl ${categoryBg}`}>
          <Ionicons name={categoryIcon ?? 'construct'} size={20} color="white" />
        </View>
        <Text className="flex-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      </View>
      <Text className="mb-6 text-gray-600">{request.description}</Text>

      <View className="mb-6 flex-row items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-4">
        <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
        <Text className="flex-1 text-xs text-gray-400">
          Customer contact details unlock once you accept this job.
        </Text>
      </View>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
      />

      <Pressable
        onPress={handleAccept}
        disabled={updateRequest.isPending}
        className="mt-6 items-center rounded-lg bg-orange-500 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {updateRequest.isPending ? 'Accepting…' : 'Accept Job'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// App-sourced request: the reseller calls the customer directly (their
// number comes from their profile since they have an app account), confirms
// exactly what's wrong, and writes that up as a remark for the technician -
// then the customer needs to approve the price before a technician can be
// assigned.
function SendQuote({ request, userId }: { request: ServiceRequest; userId: string }) {
  const { data: customer } = useSupabaseRow('profiles', request.client_id);
  const [quotedPrice, setQuotedPrice] = useState('');
  const [remark, setRemark] = useState('');
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleSendQuote() {
    const price = Number(quotedPrice);
    if (!quotedPrice.trim() || Number.isNaN(price) || price <= 0) {
      showAlert('Add a price', 'Enter what you\'d charge the customer before sending the quote.');
      return;
    }
    if (!remark.trim()) {
      showAlert('Add a remark', 'Call the customer, confirm the exact problem, and write it down first.');
      return;
    }
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        values: { reseller_id: userId, quoted_price: price, remark: remark.trim(), status: 'quoted' },
      });
      showAlert('Quote sent', 'Waiting for the customer to approve it before you can assign a technician.');
      router.replace('/(reseller)/requests');
    } catch (err) {
      showAlert('Could not send quote', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={customer?.full_name}
        customerPhone={customer?.phone}
      />

      <Text className="mb-1 mt-6 text-sm font-medium text-gray-700">Remark</Text>
      <Text className="mb-2 text-xs text-gray-400">
        Call the customer above, confirm exactly what's wrong, then write it here so the technician knows what
        they're walking into.
      </Text>
      <TextInput
        value={remark}
        onChangeText={setRemark}
        placeholder="e.g. Printer jams on every print, roller looks worn out"
        multiline
        numberOfLines={4}
        className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm"
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Quoted price (NPR)</Text>
      <Text className="mb-2 text-xs text-gray-400">
        The customer needs to approve this price before you can assign a technician.
      </Text>
      <TextInput
        value={quotedPrice}
        onChangeText={setQuotedPrice}
        placeholder="e.g. 2000"
        keyboardType="numeric"
        className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
      />

      <Pressable
        onPress={handleSendQuote}
        disabled={updateRequest.isPending}
        className="items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {updateRequest.isPending ? 'Sending…' : 'Send quote to customer'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function WaitingForApproval({ request }: { request: ServiceRequest }) {
  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <View className="rounded-xl bg-amber-50 border border-amber-200 p-5">
        <Text className="text-sm uppercase tracking-wide text-amber-600">Awaiting customer approval</Text>
        <Text className="mt-1 text-lg font-semibold text-amber-800">
          Quoted NPR {Number(request.quoted_price).toLocaleString()}
        </Text>
        <Text className="mt-2 text-sm text-amber-700">
          You'll be able to assign a technician once the customer approves this price.
        </Text>
      </View>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <RemarkBlock remark={request.remark} />
    </ScrollView>
  );
}

function ChooseTechnician({ request }: { request: ServiceRequest }) {
  const { rankedTechnicians, isLoading: loadingTechs } = useRankedTechnicians(request.location_data);
  const updateRequest = useSupabaseUpdate('service_requests');

  async function handleAssign(technicianId: string) {
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        values: { technician_id: technicianId, status: 'assigned' },
      });
      showAlert('Technician assigned', 'The job has been handed off.');
      router.replace('/(reseller)/requests');
    } catch (err) {
      showAlert('Could not assign', getErrorMessage(err));
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">{request.issue_type}</Text>
      <Text className="mb-2 text-gray-600">{request.description}</Text>

      <View className="rounded-xl bg-green-50 border border-green-200 p-4">
        <Text className="text-sm font-semibold text-green-700">
          Customer approved NPR {Number(request.quoted_price).toLocaleString()} — pick a technician below.
        </Text>
      </View>

      <RequestDetailsExtras
        scheduledDate={request.scheduled_date}
        scheduledTime={request.scheduled_time}
        location={request.location_data}
        photoUrls={request.photo_urls}
        customerName={request.customer_name}
        customerPhone={request.customer_phone}
      />

      <RemarkBlock remark={request.remark} />

      <View className="mt-6">
        <TechnicianPicker
          technicians={rankedTechnicians}
          isLoading={loadingTechs}
          locationKnown={request.location_data?.latitude != null}
          onAssign={handleAssign}
          disabled={updateRequest.isPending}
        />
      </View>
    </ScrollView>
  );
}

export default function ResellerRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: request, isLoading: loadingRequest } = useSupabaseRow('service_requests', id);

  if (loadingRequest || !request || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading…</Text>
      </View>
    );
  }

  const isMine = request.reseller_id === userId;

  if (request.status === 'pending') {
    if (request.origin === 'reseller') {
      if (!isMine) {
        return (
          <View className="flex-1 bg-gray-50 px-6 pt-4">
            <Text className="text-lg font-semibold text-gray-900">This is another reseller's customer.</Text>
          </View>
        );
      }
      return <SelfSourcedAssign request={request} userId={userId} />;
    }
    if (!isMine) {
      return <AcceptIncomingRequest request={request} userId={userId} />;
    }
    return <SendQuote request={request} userId={userId} />;
  }

  if (request.status === 'quoted' && isMine) {
    return <WaitingForApproval request={request} />;
  }

  if (request.status === 'approved' && isMine) {
    return <ChooseTechnician request={request} />;
  }

  if (isMine) {
    return <JobTracking request={request} />;
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <Text className="text-lg font-semibold text-gray-900">This request is already {request.status}.</Text>
      <Text className="mt-2 text-gray-500">Someone else may have claimed it already.</Text>
    </View>
  );
}
