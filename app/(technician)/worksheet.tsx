// app/(technician)/worksheet.tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, Text, TextInput, Pressable, ScrollView, Modal, Platform, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery } from '../../lib/hooks/useSupabase';
import { useMyEmployment, staffAddJob } from '../../lib/hooks/useTechnicianEmployment';
import { claimOpenJob, useUnassignedTeamJobs } from '../../lib/hooks/useJobOffers';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { PressScale } from '../../lib/components/Motion';
import { RequestPhotoThumb } from '../../lib/components/RequestPhotoThumb';
import { SuggestInput } from '../../lib/components/finance/SuggestInput';
import { WEB_SIDEBAR_MIN_WIDTH } from '../../lib/components/web/WebSidebarShell';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { distanceKm } from '../../lib/utils/distance';
import { formatMoney } from '../../lib/utils/money';
import type { ServiceRequest } from '../../types/database.types';

const BLUE = '#2563EB';
const INK = '#111827';
const INPUT = 'rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-[15px] text-gray-900';

type Spot = { latitude: number; longitude: number };

function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function kmTo(job: ServiceRequest, me: Spot | null): number | null {
  const { latitude, longitude } = job.location_data ?? {};
  return me && latitude != null && longitude != null ? distanceKm(me, { latitude, longitude }) : null;
}

const kmText = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`);

function Price({ job, size = 21 }: { job: ServiceRequest; size?: number }) {
  if (job.quoted_price == null) return <Text className="text-right text-[12.5px] font-semibold text-gray-500">Owner sets the price</Text>;
  return (
    <Text className="font-extrabold text-gray-900" style={{ fontSize: size, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
      NPR {formatMoney(Number(job.quoted_price))}
    </Text>
  );
}

/** Where the job is, drawn as a short route from the technician when their distance is known. */
function Route({ job, km }: { job: ServiceRequest; km: number | null }) {
  const address = job.location_data?.address;
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      <View className="items-center" style={{ width: 16, paddingTop: 3 }}>
        {km != null && (
          <>
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: BLUE }} />
            <View style={{ width: 2, height: 14, marginVertical: 2, backgroundColor: '#BFDBFE' }} />
          </>
        )}
        <Ionicons name="location" size={16} color={BLUE} />
      </View>
      <View className="flex-1" style={{ gap: 4 }}>
        {km != null && (
          <Text className="text-[13px] font-semibold text-gray-700" style={{ lineHeight: 17 }}>
            {kmText(km)}
          </Text>
        )}
        <Text className={`text-[14px] ${address ? 'text-gray-900' : 'text-gray-500'}`} numberOfLines={2} style={{ lineHeight: 19 }}>
          {address || 'No address yet - ask the owner'}
        </Text>
      </View>
    </View>
  );
}

function TakeButton({ busy, taking, onPress }: { busy: boolean; taking: boolean; onPress: () => void }) {
  if (busy) {
    return (
      <View className="flex-row items-center justify-center rounded-2xl bg-gray-100" style={{ minHeight: 52, gap: 8 }}>
        <Ionicons name="lock-closed" size={15} color="#4B5563" />
        <Text className="text-[14px] font-semibold text-gray-600">Finish your current job first</Text>
      </View>
    );
  }
  return (
    <PressScale
      onPress={onPress}
      disabled={taking}
      accessibilityRole="button"
      accessibilityLabel="Take this job"
      className="flex-row items-center justify-center rounded-2xl"
      style={{ minHeight: 52, gap: 8, backgroundColor: BLUE, opacity: taking ? 0.65 : 1 }}
    >
      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
      <Text className="text-[16px] font-bold text-white">{taking ? 'Taking…' : 'Take job'}</Text>
    </PressScale>
  );
}

/** One request in the feed: who, how much, what and where, with a single action. The row itself opens the details. */
function RequestCard({ job, km, now, footer, onOpen }: { job: ServiceRequest; km: number | null; now: number; footer: ReactNode; onOpen: () => void }) {
  return (
    <View className="rounded-3xl bg-white p-4" style={{ gap: 12, boxShadow: '0 1px 2px rgba(17,24,39,0.05), 0 6px 18px rgba(17,24,39,0.05)' }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Details of ${job.issue_type}`} style={{ gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <PersonAvatar name={job.customer_name ?? 'Customer'} size={42} bg="bg-blue-600" />
          <View className="flex-1" style={{ minWidth: 0 }}>
            <Text className="text-[15px] font-bold text-gray-900" numberOfLines={1}>
              {job.customer_name ?? 'Customer'}
            </Text>
            <Text className="mt-0.5 text-[12.5px] text-gray-500">{timeAgo(job.created_at, now)}</Text>
          </View>
          <View className="items-end" style={{ maxWidth: '50%' }}>
            <Price job={job} />
          </View>
        </View>

        <View className="flex-row items-center" style={{ gap: 10 }}>
          <CategoryBadge category={job.issue_type} size={40} />
          <Text className="flex-1 text-[15px] font-semibold text-gray-900" numberOfLines={2} style={{ lineHeight: 20 }}>
            {job.issue_type}
          </Text>
        </View>

        <Route job={job} km={km} />

        {!!job.description && (
          <Text className="text-[13.5px] text-gray-600" numberOfLines={2} style={{ lineHeight: 19 }}>
            {job.description}
          </Text>
        )}
      </Pressable>
      {footer}
    </View>
  );
}

/** The job in hand, pinned above the feed: nothing else can be taken until it is done. */
function CurrentJobBar({ job, onOpen }: { job: ServiceRequest; onOpen: () => void }) {
  return (
    <PressScale
      scaleTo={0.985}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open your current job, ${job.issue_type}`}
      className="flex-row items-center rounded-2xl px-3.5 py-3"
      style={{ gap: 12, backgroundColor: INK }}
    >
      <CategoryBadge category={job.issue_type} size={40} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-[14.5px] font-bold text-white" numberOfLines={1}>
          {job.issue_type}
        </Text>
        <Text className="mt-0.5 text-[12.5px]" style={{ color: '#D1D5DB' }} numberOfLines={1}>
          Working on this · {job.customer_name ?? 'Customer'}
        </Text>
      </View>
      <Text className="text-[13px] font-semibold text-white">Open</Text>
      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
    </PressScale>
  );
}

/** A soft pulse beside the count: the feed is live and new work arrives by itself. */
function LiveDot() {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.exp), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#22C55E',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' }} />
    </View>
  );
}

function FeedHeader({
  count,
  company,
  sort,
  canSortNear,
  onSort,
  onAdd,
}: {
  count: number;
  company: string;
  sort: 'new' | 'near';
  canSortNear: boolean;
  onSort: (s: 'new' | 'near') => void;
  onAdd?: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <LiveDot />
            <Text className="text-[22px] font-extrabold text-gray-900">{count === 1 ? '1 job waiting' : `${count} jobs waiting`}</Text>
          </View>
          <Text className="mt-0.5 text-[13px] text-gray-500" numberOfLines={1}>
            {company}
          </Text>
        </View>
        {!!onAdd && (
          <PressScale onPress={onAdd} accessibilityRole="button" className="flex-row items-center rounded-2xl px-4" style={{ minHeight: 44, gap: 6, backgroundColor: BLUE }}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text className="text-[14px] font-bold text-white">Add work</Text>
          </PressScale>
        )}
      </View>
      {canSortNear && (
        <View className="flex-row" style={{ gap: 8 }}>
          {(
            [
              ['new', 'Newest'],
              ['near', 'Nearest'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => onSort(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === key }}
              className="items-center justify-center rounded-full px-4"
              style={{ minHeight: 36, backgroundColor: sort === key ? INK : '#E5E7EB' }}
            >
              <Text className="text-[13px] font-semibold" style={{ color: sort === key ? '#FFFFFF' : '#374151' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Rises from the bottom of a phone; a centred card on a wide screen. */
function Sheet({ visible, title, wide, onClose, children }: { visible: boolean; title: string; wide: boolean; onClose: () => void; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    rise.setValue(reduceMotion ? 1 : 0);
    Animated.timing(rise, { toValue: 1, duration: 280, easing: Easing.out(Easing.exp), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, reduceMotion, rise]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className={`flex-1 bg-black/50 ${wide ? 'items-center justify-center px-4' : 'justify-end'}`} onPress={onClose}>
        <Animated.View
          style={{
            width: '100%',
            maxWidth: wide ? 500 : undefined,
            maxHeight: '90%',
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [wide ? 16 : 60, 0] }) }],
          }}
        >
          <Pressable onPress={() => {}} className={`bg-white ${wide ? 'rounded-3xl' : 'rounded-t-3xl'}`} style={{ maxHeight: '100%' }}>
            {!wide && <View className="mt-2.5 self-center rounded-full bg-gray-300" style={{ width: 40, height: 4 }} />}
            <View className="flex-row items-center px-5 pb-1 pt-3.5" style={{ gap: 10 }}>
              <Text className="flex-1 text-[19px] font-extrabold text-gray-900" numberOfLines={2}>
                {title}
              </Text>
              <Pressable onPress={onClose} accessibilityLabel="Close" className="items-center justify-center rounded-full bg-gray-100" style={{ width: 36, height: 36 }}>
                <Ionicons name="close" size={20} color="#374151" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Detail({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View className="flex-row items-start" style={{ gap: 10 }}>
      <Ionicons name={icon} size={17} color="#6B7280" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-[14.5px] text-gray-800" style={{ lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  );
}

/** A request read in full before taking it. Nobody owns it yet, so it has no job page of its own. */
function JobDetails({
  job,
  km,
  wide,
  busy,
  taking,
  onTake,
  onClose,
}: {
  job: ServiceRequest | null;
  km: number | null;
  wide: boolean;
  busy: boolean;
  taking: boolean;
  onTake: () => void;
  onClose: () => void;
}) {
  const schedule = [job?.scheduled_date, job?.scheduled_time].filter(Boolean).join(' · ');
  return (
    <Sheet visible={!!job} title={job?.issue_type ?? ''} wide={wide} onClose={onClose}>
      {job && (
        <>
          <Price job={job} size={26} />
          <View style={{ gap: 10 }}>
            <Detail icon="person-outline">{[job.customer_name ?? 'Customer', job.customer_phone].filter(Boolean).join(' · ')}</Detail>
            <Detail icon="location-outline">{[job.location_data?.address || 'No address yet', km != null ? kmText(km) : null].filter(Boolean).join(' · ')}</Detail>
            {!!schedule && <Detail icon="calendar-outline">{schedule}</Detail>}
            {!!job.description && <Detail icon="document-text-outline">{job.description}</Detail>}
          </View>
          {(job.photo_urls?.length ?? 0) > 0 && <RequestPhotoThumb photoUrls={job.photo_urls} size={88} />}
          <TakeButton busy={busy} taking={taking} onPress={onTake} />
        </>
      )}
    </Sheet>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-1.5 text-[13px] font-semibold text-gray-700">{label}</Text>
      {children}
    </View>
  );
}

/** The Add work form: the service (picked from the list, or typed), who it is for and where. The price stays the owner's. */
function AddWork({ visible, wide, onClose }: { visible: boolean; wide: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: categories } = useSupabaseQuery('service_categories', {
    filters: { is_active: true },
    orderBy: { column: 'sort_order' },
    enabled: visible,
  });
  const [service, setService] = useState('');
  const [focused, setFocused] = useState(false);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const q = service.trim().toLowerCase();
    return (categories ?? [])
      .flatMap((c) => [`${c.label} - Installation`, `${c.label} - Repair`])
      .filter((name) => !q || name.toLowerCase().includes(q))
      .map((name) => ({ key: name, label: name }));
  }, [categories, service]);

  async function save() {
    if (!service.trim() || !customer.trim()) {
      showAlert('Almost there', "Add the service and the customer's name.");
      return;
    }
    setSaving(true);
    try {
      await staffAddJob({ service, customer, phone, address, note });
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      setService('');
      setCustomer('');
      setPhone('');
      setAddress('');
      setNote('');
      onClose();
    } catch (err) {
      showAlert('Could not add the work', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} title="Add work" wide={wide} onClose={onClose}>
      <View style={{ zIndex: 10 }}>
        <FormField label="Service *">
          <SuggestInput
            value={service}
            onChangeText={setService}
            options={focused ? options : []}
            onSelectOption={(o) => setService(o.label)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            showWhenEmpty
            placeholder="Pick or type a service"
            accessibilityLabel="Service"
            accent={BLUE}
            inputClassName={INPUT}
          />
        </FormField>
      </View>
      <FormField label="Customer name *">
        <TextInput value={customer} onChangeText={setCustomer} className={INPUT} accessibilityLabel="Customer name" />
      </FormField>
      <FormField label="Phone">
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" className={INPUT} accessibilityLabel="Phone" />
      </FormField>
      <FormField label="Address">
        <TextInput value={address} onChangeText={setAddress} className={INPUT} accessibilityLabel="Address" />
      </FormField>
      <FormField label="Note">
        <TextInput value={note} onChangeText={setNote} multiline className={INPUT} style={{ minHeight: 72, textAlignVertical: 'top' }} accessibilityLabel="Note" />
      </FormField>
      <Text className="text-[12.5px] text-gray-500" style={{ lineHeight: 18 }}>
        The owner is told, and sets the price. Anyone on the team can then take this job, you included.
      </Text>
      <PressScale
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        className="flex-row items-center justify-center rounded-2xl"
        style={{ minHeight: 52, backgroundColor: BLUE, opacity: saving ? 0.65 : 1 }}
      >
        <Text className="text-[16px] font-bold text-white">{saving ? 'Saving…' : 'Add to the worksheet'}</Text>
      </PressScale>
    </Sheet>
  );
}

function EmptyFeed() {
  return (
    <View className="items-center rounded-3xl bg-white px-6 py-12">
      <View className="items-center justify-center rounded-full bg-blue-50" style={{ width: 60, height: 60 }}>
        <Ionicons name="radio-outline" size={28} color={BLUE} />
      </View>
      <Text className="mt-3 text-[16px] font-bold text-gray-900">No jobs waiting</Text>
      <Text className="mt-1 text-center text-[13.5px] text-gray-500" style={{ lineHeight: 19 }}>
        New work shows up here by itself.
      </Text>
    </View>
  );
}

/** A technician's Worksheet, a live feed of work: all their employer's unassigned jobs to take once they are free, with
 * the job in hand pinned on top and anything offered to them first. Only for someone employed. */
export default function TechnicianWorksheet() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { current, employer } = useMyEmployment(userId);
  const isStaff = current?.status === 'accepted';
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<ServiceRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sort, setSort] = useState<'new' | 'near'>('new');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { data: mine } = useSupabaseQuery('service_requests', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId && isStaff,
  });
  const { data: spots } = useSupabaseQuery('technician_locations', {
    filters: userId ? { technician_id: userId } : {},
    enabled: !!userId && isStaff,
  });
  const myLat = spots?.[0]?.latitude;
  const myLng = spots?.[0]?.longitude;
  const me: Spot | null = useMemo(() => (myLat != null && myLng != null ? { latitude: myLat, longitude: myLng } : null), [myLat, myLng]);
  const unassigned = useUnassignedTeamJobs(isStaff ? current?.reseller_id : undefined);

  const working = useMemo(() => (mine ?? []).filter((j) => j.status === 'in_progress' && j.hold_status !== 'on_hold'), [mine]);
  const onHold = useMemo(() => (mine ?? []).filter((j) => j.status === 'in_progress' && j.hold_status === 'on_hold'), [mine]);
  const offered = useMemo(() => (mine ?? []).filter((j) => j.status === 'assigned'), [mine]);
  const busy = working.length > 0;

  const canSortNear = unassigned.some((j) => kmTo(j, me) != null);
  // Newest first; Nearest puts jobs with no map point after the ones with a known distance.
  const feed = [...unassigned].sort((a, b) =>
    sort === 'near' && canSortNear ? (kmTo(a, me) ?? Infinity) - (kmTo(b, me) ?? Infinity) : b.created_at.localeCompare(a.created_at)
  );

  async function take(job: ServiceRequest) {
    setBusyId(job.id);
    try {
      await claimOpenJob(job.id);
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      await queryClient.invalidateQueries({ queryKey: ['job_cards'] });
      setViewing(null);
      router.push(`/(technician)/job/${job.id}` as never);
    } catch (err) {
      const message = getErrorMessage(err);
      showAlert(message.includes('already taken') ? 'Too late' : 'Could not take this job', message.includes('already taken') ? 'A teammate got to this one first.' : message);
      setViewing(null);
      await queryClient.invalidateQueries({ queryKey: ['service_requests'] });
    } finally {
      setBusyId(null);
    }
  }

  if (!isStaff) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100 px-8">
        <Ionicons name="lock-closed-outline" size={30} color="#9CA3AF" />
        <Text className="mt-3 text-center text-[15px] font-semibold text-gray-700">This is for employees</Text>
        <Text className="mt-1 text-center text-[13px] text-gray-500">The Worksheet shows your employer's work once you are on their team.</Text>
      </View>
    );
  }

  const open = (job: ServiceRequest) => router.push(`/(technician)/job/${job.id}` as never);
  const company = `${employer?.business_name || employer?.full_name || 'Your employer'}'s work`;
  const cardWidth = wide ? { flexBasis: 380, flexGrow: 1, maxWidth: 560 } : { width: '100%' as const };

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView contentContainerStyle={{ padding: wide ? 28 : 14, paddingBottom: wide ? 40 : 96, gap: 14 }}>
        {working.map((j) => (
          <CurrentJobBar key={j.id} job={j} onOpen={() => open(j)} />
        ))}

        <FeedHeader count={feed.length} company={company} sort={sort} canSortNear={canSortNear} onSort={setSort} onAdd={wide ? () => setAdding(true) : undefined} />

        {offered.length > 0 && (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {offered.map((j) => (
              <View key={j.id} style={cardWidth}>
                <RequestCard
                  job={j}
                  km={kmTo(j, me)}
                  now={now}
                  onOpen={() => open(j)}
                  footer={
                    <PressScale onPress={() => open(j)} accessibilityRole="button" className="items-center justify-center rounded-2xl" style={{ minHeight: 52, backgroundColor: '#DBEAFE' }}>
                      <Text className="text-[15px] font-bold" style={{ color: '#1D4ED8' }}>
                        Offered to you - open to accept
                      </Text>
                    </PressScale>
                  }
                />
              </View>
            ))}
          </View>
        )}

        {feed.length === 0 ? (
          <EmptyFeed />
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {feed.map((j) => (
              <View key={j.id} style={cardWidth}>
                <RequestCard
                  job={j}
                  km={kmTo(j, me)}
                  now={now}
                  onOpen={() => setViewing(j)}
                  footer={<TakeButton busy={busy} taking={busyId === j.id} onPress={() => take(j)} />}
                />
              </View>
            ))}
          </View>
        )}

        {onHold.map((j) => (
          <Pressable key={j.id} onPress={() => open(j)} accessibilityRole="button" className="flex-row items-center rounded-2xl bg-white px-3.5" style={{ minHeight: 56, gap: 10 }}>
            <Ionicons name="pause-circle" size={22} color="#D97706" />
            <Text className="flex-1 text-[14px] font-semibold text-gray-800" numberOfLines={1}>
              On hold: {j.issue_type}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </Pressable>
        ))}
      </ScrollView>

      {!wide && (
        <View pointerEvents="box-none" className="absolute inset-x-0 bottom-4 items-center">
          <PressScale
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            className="flex-row items-center rounded-full px-6"
            style={{ minHeight: 52, gap: 6, backgroundColor: BLUE, boxShadow: '0 6px 18px rgba(37,99,235,0.35)' }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text className="text-[15px] font-bold text-white">Add work</Text>
          </PressScale>
        </View>
      )}

      <JobDetails
        job={viewing}
        km={viewing ? kmTo(viewing, me) : null}
        wide={wide}
        busy={busy}
        taking={!!viewing && busyId === viewing.id}
        onTake={() => viewing && take(viewing)}
        onClose={() => setViewing(null)}
      />
      <AddWork visible={adding} wide={wide} onClose={() => setAdding(false)} />
    </View>
  );
}
