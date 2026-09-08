// app/(reseller)/requests.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow, useSupabaseUpdate } from '../../lib/hooks/useSupabase';
import { distanceKm } from '../../lib/utils/distance';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { RequestPhotoThumb } from '../../lib/components/RequestPhotoThumb';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { OrderCard } from '../../lib/components/OrderCard';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import type { Order, RequestStatus, ServiceRequest } from '../../types/database.types';

// "My Jobs" mixed every status (and payment state) into one flat list, so it
// was hard to tell what actually needed attention. Group by pipeline stage
// instead - what the reseller should be doing right now for that job - with
// a plain-language hint per card, rather than making them decode raw status
// strings across the whole list. There used to be a separate "Needs your
// action" stage covering both "claimed, still needs a quote" and "approved,
// needs a technician" - it's gone now: the former folds into "Waiting on
// customer" (the reseller's own next step there is just to call the
// customer and send a quote, but the request is functionally waiting on
// that conversation), and the latter becomes its own "My Jobs" stage,
// positioned right before "Job in progress" since picking a technician is
// the last thing standing between an approved job and it actually starting.
type Stage = 'requests' | 'waiting_customer' | 'my_jobs' | 'in_progress' | 'awaiting_payment' | 'completed' | 'cancelled';

const STAGE_ORDER: Stage[] = ['requests', 'waiting_customer', 'my_jobs', 'in_progress', 'awaiting_payment', 'completed', 'cancelled'];

const STAGE_META: Record<Stage, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  requests: { label: 'Requests', icon: 'download-outline', color: '#EA580C', bg: 'bg-orange-50' },
  waiting_customer: { label: 'Waiting on customer', icon: 'time-outline', color: '#D97706', bg: 'bg-amber-50' },
  my_jobs: { label: 'My Jobs', icon: 'briefcase', color: '#2563eb', bg: 'bg-blue-50' },
  in_progress: { label: 'Job in progress', icon: 'build', color: '#2563EB', bg: 'bg-blue-50' },
  awaiting_payment: { label: 'Awaiting payment', icon: 'cash-outline', color: '#DC2626', bg: 'bg-red-50' },
  completed: { label: 'Completed', icon: 'checkmark-done-circle', color: '#16A34A', bg: 'bg-green-50' },
  cancelled: { label: 'Cancelled', icon: 'close-circle', color: '#9CA3AF', bg: 'bg-gray-100' },
};

function stageOf(item: ServiceRequest): Stage {
  switch (item.status) {
    case 'cancelled':
      return 'cancelled';
    case 'pending':
      // A self-sourced (reseller-posted) job skips the quote/approval
      // conversation entirely - SelfSourcedAssign lets the reseller pick a
      // technician immediately, the same next step as an app request whose
      // price was just approved, so it lands directly in "My Jobs" instead
      // of "Waiting on customer" (there's no customer to wait on).
      return item.origin === 'reseller' ? 'my_jobs' : 'waiting_customer';
    case 'quoted':
      return 'waiting_customer';
    case 'approved':
      return 'my_jobs';
    case 'assigned':
    case 'in_progress':
      return 'in_progress';
    case 'resolved':
      return item.payment_status === 'paid' ? 'completed' : 'awaiting_payment';
  }
}

// A pending order hasn't been looked at yet - same as a brand new,
// unclaimed service request, it belongs in "Requests" until the reseller
// confirms it. A confirmed order still needs shipping - the same "ready to
// act on" idea "My Jobs" covers for an approved service request - and a
// shipped one is in progress the same way an assigned job is. Once
// delivered there's nothing left to do, same as a paid, resolved request.
function orderStageOf(order: Order): Stage {
  switch (order.status) {
    case 'pending':
      return 'requests';
    case 'confirmed':
      return 'my_jobs';
    case 'shipped':
      return 'in_progress';
    case 'delivered':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'requests';
  }
}

type JobItem = { kind: 'request'; id: string; request: ServiceRequest } | { kind: 'order'; id: string; order: Order };

function nextStepHint(item: ServiceRequest): string | null {
  switch (item.status) {
    case 'pending':
      return item.origin === 'reseller'
        ? 'Pick a technician to assign.'
        : 'Call the customer to verify the issue, then send them a quote.';
    case 'quoted':
      return `Waiting for the customer to approve NPR ${Number(item.quoted_price ?? 0).toLocaleString()}.`;
    case 'approved':
      return 'Customer approved the price — pick a technician to assign.';
    case 'assigned':
      return 'Technician assigned — job hasn’t started yet.';
    case 'in_progress':
      return 'Technician is on the job right now.';
    case 'resolved':
      return item.payment_status === 'paid' ? 'Paid in full.' : 'Job done — collect payment from the customer.';
    case 'cancelled':
      return 'This request was cancelled.';
    default:
      return null;
  }
}

function StatusPill({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}


function IncomingRequestCard({ item }: { item: ServiceRequest }) {
  // Incoming is pre-acceptance - the customer's identity (photo, name,
  // address) helps a reseller decide whether to take the job, but their
  // contact number stays hidden until the reseller actually accepts it.
  const { data: customerProfile } = useSupabaseRow('profiles', item.client_id);
  const customerName = item.customer_name ?? customerProfile?.full_name;

  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
      <Pressable onPress={() => router.push(`/(reseller)/request/${item.id}`)} className="flex-row items-start gap-3">
        <View className="items-center gap-1.5">
          <CategoryBadge category={item.issue_type} />
          <RequestPhotoThumb photoUrls={item.photo_urls} size={44} />
          <PersonAvatar name={customerName} photoUrl={customerProfile?.avatar_url} size={32} bg="bg-orange-500" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
            <View className="rounded-full bg-amber-50 px-2 py-0.5">
              <Text className="text-[10px] font-semibold uppercase text-amber-600">Pending</Text>
            </View>
          </View>
          {item.description && (
            <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View className="mt-2 gap-1">
            {customerName && (
              <Text className="text-xs text-gray-500">
                <Text className="font-medium text-gray-600">Customer: </Text>
                {customerName}
              </Text>
            )}
            {(item.scheduled_date || item.scheduled_time) && (
              <Text className="text-xs text-gray-500">
                {item.scheduled_date ?? 'Date TBD'} · {item.scheduled_time ?? 'Time TBD'}
              </Text>
            )}
            {item.location_data?.address && (
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {item.location_data.address}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push(`/(reseller)/request/${item.id}`)}
        className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5"
      >
        <Ionicons name="checkmark-circle" size={16} color="white" />
        <Text className="text-sm font-semibold text-white">View &amp; Accept</Text>
      </Pressable>
    </View>
  );
}

function MyRequestCard({ item }: { item: ServiceRequest }) {
  // A "reseller" origin request's client_id is just the reseller's own id
  // (there's no real customer profile behind it), so only look up a photo
  // for real app customers.
  const { data: customerProfile } = useSupabaseRow('profiles', item.origin === 'app' ? item.client_id : undefined);
  const { data: technicianProfile } = useSupabaseRow('profiles', item.technician_id ?? undefined);
  const updateRequest = useSupabaseUpdate('service_requests');
  const [cancelling, setCancelling] = useState(false);

  const customerName = item.customer_name ?? customerProfile?.full_name;
  const customerPhone = item.customer_phone ?? customerProfile?.phone;
  const hint = nextStepHint(item);
  const stage = stageOf(item);
  const stageMeta = STAGE_META[stage];

  const distance =
    item.location_data?.latitude != null &&
    item.location_data?.longitude != null &&
    technicianProfile?.latitude != null &&
    technicianProfile?.longitude != null
      ? distanceKm(
          { latitude: item.location_data.latitude, longitude: item.location_data.longitude },
          { latitude: technicianProfile.latitude, longitude: technicianProfile.longitude }
        )
      : null;

  // Only requests the reseller sourced themselves - never a real app
  // customer's, which isn't this reseller's to change - and only while
  // there's still something to change: once it's paid/resolved or already
  // cancelled, editing or cancelling it doesn't mean anything anymore.
  const canManage = item.origin === 'reseller' && item.status !== 'resolved' && item.status !== 'cancelled';

  function handleCancel() {
    showAlert('Cancel this request?', "This marks it as cancelled - it can't be undone.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await updateRequest.mutateAsync({ id: item.id, values: { status: 'cancelled' } });
          } catch (err) {
            showAlert('Could not cancel', getErrorMessage(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
      <Pressable onPress={() => router.push(`/(reseller)/request/${item.id}`)} className="flex-row items-start gap-3">
      <View className="items-center gap-1.5">
        <CategoryBadge category={item.issue_type} />
        <RequestPhotoThumb photoUrls={item.photo_urls} size={44} />
        <PersonAvatar
          name={customerName}
          photoUrl={item.origin === 'app' ? customerProfile?.avatar_url : null}
          size={32}
          bg="bg-orange-500"
        />
        {technicianProfile && (
          <PersonAvatar name={technicianProfile.full_name} photoUrl={technicianProfile.avatar_url} size={32} bg="bg-blue-600" />
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 font-semibold text-gray-900">{item.issue_type}</Text>
          <StatusPill status={item.status} />
        </View>
        {item.description && (
          <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <View className={`rounded-full px-2 py-0.5 ${item.origin === 'app' ? 'bg-blue-50' : 'bg-purple-50'}`}>
            <Text
              className={`text-[10px] font-semibold ${item.origin === 'app' ? 'text-blue-700' : 'text-purple-700'}`}
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
          {item.chalan_urls.length > 0 && (
            <View className="flex-row items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5">
              <Ionicons name="document-attach" size={10} color="#0F766E" />
              <Text className="text-[10px] font-semibold text-teal-700">Chalan attached</Text>
            </View>
          )}
        </View>

        <View className="mt-2.5 gap-1">
          {(customerName || customerPhone) && (
            <Text className="text-xs text-gray-500">
              <Text className="font-medium text-gray-600">Customer: </Text>
              {customerName ?? 'Unknown'}
              {customerPhone ? ` · ${customerPhone}` : ''}
            </Text>
          )}
          {technicianProfile && (
            <Text className="text-xs text-gray-500">
              <Text className="font-medium text-gray-600">Assigned to: </Text>
              {technicianProfile.full_name ?? 'Unnamed'}
              {distance != null ? ` · ${distance.toFixed(1)} km away` : ''}
            </Text>
          )}
          {(item.scheduled_date || item.scheduled_time) && (
            <Text className="text-xs text-gray-500">
              <Text className="font-medium text-gray-600">When: </Text>
              {item.scheduled_date ?? 'Date TBD'} · {item.scheduled_time ?? 'Time TBD'}
            </Text>
          )}
          {item.location_data?.address && (
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              <Text className="font-medium text-gray-600">Address: </Text>
              {item.location_data.address}
            </Text>
          )}
          {hint && (
            <Text className="text-xs font-medium" style={{ color: stageMeta.color }}>
              {hint}
            </Text>
          )}
          {item.remark && (
            <Text className="mt-1 text-xs italic text-gray-400" numberOfLines={2}>
              "{item.remark}"
            </Text>
          )}
        </View>

        {item.quoted_price != null && stage !== 'in_progress' && (
          <View className="mt-2 flex-row justify-end">
            <Text className="text-2xl font-extrabold text-gray-900">
              NPR {Number(item.quoted_price).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
      </Pressable>

      {canManage && (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => router.push(`/(reseller)/edit-request?id=${item.id}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2"
          >
            <Ionicons name="create-outline" size={14} color="#374151" />
            <Text className="text-xs font-semibold text-gray-700">Edit</Text>
          </Pressable>
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 disabled:opacity-50"
          >
            <Ionicons name="trash-outline" size={14} color="#DC2626" />
            <Text className="text-xs font-semibold text-red-600">{cancelling ? 'Cancelling…' : 'Delete'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function ResellerRequestQueue() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [jobStage, setJobStage] = useState<Stage | null>(null);
  // A phone browser hitting the website is still "web" (Platform.OS ===
  // 'web'), but the 2-column card grid and flat chip row below only make
  // sense once the viewport is wide enough for it - same breakpoint as the
  // sidebar shell this screen normally renders inside.
  const { width: screenWidth } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && screenWidth >= WEB_SIDEBAR_MIN_WIDTH;

  const { data: incomingRaw, isLoading: loadingIncoming } = useSupabaseQuery('service_requests', {
    filters: { status: 'pending', origin: 'app' },
    orderBy: { column: 'created_at', ascending: true },
  });
  // Any reseller can see a pending app request until someone claims it -
  // once reseller_id is stamped (see AcceptIncomingRequest), it belongs to
  // that reseller and drops out of everyone else's unclaimed pool. Unclaimed
  // and claimed requests both land in the same "Needs your action" bucket
  // below - accepting one is just as much an action as quoting or assigning.
  const incoming = useMemo(() => (incomingRaw ?? []).filter((r) => !r.reseller_id), [incomingRaw]);

  const { data: mine, isLoading: loadingMine } = useSupabaseQuery('service_requests', {
    filters: userId ? { reseller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });

  // Product orders from customers (Shop no longer has its own Orders tab -
  // a new order needs the same "act on this now" attention as a new service
  // request, so it surfaces here instead) and follow the exact same stage
  // pipeline as a service job, not Shop Overview - that tab is for the
  // running numbers, not the work queue.
  const { data: sellingOrders } = useSupabaseQuery('orders', {
    filters: userId ? { seller_id: userId } : {},
    orderBy: { column: 'created_at', ascending: true },
    enabled: !!userId,
  });
  const { data: allProducts } = useSupabaseQuery('products', {});
  const productMap = useMemo(() => new Map((allProducts ?? []).map((p) => [p.id, p])), [allProducts]);

  const isLoading = loadingIncoming || loadingMine;

  // Everything - unclaimed requests, claimed jobs, and orders at every status
  // - lives in one stage-grouped list now. "Requests" is anything brand new
  // that hasn't been accepted/confirmed yet; "Needs your action" is only for
  // jobs already claimed that still need a quote, assignment, or shipment.
  // A reseller can jump straight to e.g. "Awaiting payment" instead of
  // scrolling past every other stage.
  const myByStage = useMemo(() => {
    const groups = new Map<Stage, JobItem[]>();
    STAGE_ORDER.forEach((stage) => groups.set(stage, []));
    incoming.forEach((item) => groups.get('requests')!.push({ kind: 'request', id: item.id, request: item }));
    (mine ?? []).forEach((item) => groups.get(stageOf(item))!.push({ kind: 'request', id: item.id, request: item }));
    (sellingOrders ?? []).forEach((order) =>
      groups.get(orderStageOf(order))!.push({ kind: 'order', id: order.id, order })
    );
    return groups;
  }, [incoming, mine, sellingOrders]);

  const activeStage = jobStage ?? STAGE_ORDER.find((stage) => (myByStage.get(stage)?.length ?? 0) > 0) ?? 'requests';
  const stageJobs = myByStage.get(activeStage) ?? [];

  // Keep the chip strip and the job list below it in sync: whichever stage
  // becomes active, scroll its chip into view at the same time the list swaps.
  const chipScrollRef = useRef<ScrollView>(null);
  const chipLayouts = useRef<Partial<Record<Stage, { x: number; width: number }>>>({});

  useEffect(() => {
    const layout = chipLayouts.current[activeStage];
    if (layout) {
      chipScrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 24), animated: true });
    }
  }, [activeStage]);

  // Chip bar: a horizontal-scroll strip makes sense on a phone (only a few
  // chips fit before running out of width), but on a laptop-wide screen all
  // 7 stages fit without scrolling - flex-wrap just lays them out flat
  // instead of hiding most of them behind a scroll gesture nobody expects
  // on a desktop toggle bar.
  const stageChip = (stage: Stage, withLayout: boolean) => {
    const meta = STAGE_META[stage];
    const count = myByStage.get(stage)?.length ?? 0;
    const active = activeStage === stage;
    return (
      <Pressable
        key={stage}
        onPress={() => setJobStage(stage)}
        onLayout={
          withLayout
            ? (e) => {
                chipLayouts.current[stage] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              }
            : undefined
        }
        className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
        style={{
          backgroundColor: active ? meta.color : '#FFFFFF',
          borderWidth: active ? 0 : 1,
          borderColor: '#E5E7EB',
        }}
      >
        <Ionicons name={meta.icon} size={13} color={active ? 'white' : meta.color} />
        <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
          {meta.label} ({count})
        </Text>
      </Pressable>
    );
  };

  // Same reasoning as the Finance grid fix: a CSS calc() width sizes each
  // card off its actual parent, so it lands at exactly `columns` across no
  // matter how wide the sidebar/content column really is - no need to guess
  // the screen width.
  const CARD_GRID_GAP = 12;
  const webCardWidth = (columns: number) =>
    `calc((100% - ${CARD_GRID_GAP * (columns - 1)}px) / ${columns})` as unknown as number;

  const jobCard = (item: JobItem) =>
    item.kind === 'request' ? (
      item.request.reseller_id ? (
        <MyRequestCard item={item.request} />
      ) : (
        <IncomingRequestCard item={item.request} />
      )
    ) : userId ? (
      <OrderCard order={item.order} productMap={productMap} viewerId={userId} basePath="/(reseller)" roleLabel="Selling" />
    ) : null;

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      {isWideWeb ? (
        <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
          {STAGE_ORDER.map((stage) => stageChip(stage, false))}
        </View>
      ) : (
        <ScrollView
          ref={chipScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          className="mb-4"
          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingRight: 8 }}
        >
          {STAGE_ORDER.map((stage) => stageChip(stage, true))}
        </ScrollView>
      )}

      <Text className="mb-3 text-base font-bold text-gray-900">{STAGE_META[activeStage].label}</Text>

      {isLoading && <Text className="text-gray-500">Loading…</Text>}
      {!isLoading && stageJobs.length === 0 && <Text className="text-gray-500">Nothing here right now.</Text>}

      {isWideWeb ? (
        // Every request/order card used to render at full content-column
        // width in a single column (a "1x1" tile per row) - way more
        // whitespace than a laptop screen needs. Lay them out 2-across
        // instead so more of the queue is visible without scrolling.
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
          <View className="flex-row flex-wrap" style={{ gap: CARD_GRID_GAP }}>
            {stageJobs.map((item) => (
              <View key={`${item.kind}-${item.id}`} style={{ width: webCardWidth(2) }}>
                {jobCard(item)}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={stageJobs}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={({ item }) => jobCard(item)}
          contentContainerStyle={{ paddingBottom: 90 }}
        />
      )}

      <Pressable
        onPress={() => router.push('/(reseller)/new-request')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-orange-500 shadow-lg"
        style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </View>
  );
}
