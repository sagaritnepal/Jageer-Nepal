// app/(technician)/dashboard.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseQuery, useSupabaseRow } from '../../lib/hooks/useSupabase';
import { STATUS_STYLES } from '../../lib/constants/requestStatus';
import { getCategoryVisual } from '../../lib/constants/categoryIcons';
import { PersonAvatar } from '../../lib/components/PersonAvatar';
import { RequestPhotoThumb } from '../../lib/components/RequestPhotoThumb';
import type { ServiceRequest } from '../../types/database.types';

function StatusPill({ status }: { status: ServiceRequest['status'] }) {
  const style = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.bg}`}>
      <Text className={`text-[10px] font-semibold uppercase ${style.text}`}>{style.label}</Text>
    </View>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  const { bg, icon } = getCategoryVisual(category);
  return (
    <View className={`h-11 w-11 items-center justify-center rounded-2xl ${bg}`}>
      <Ionicons name={icon ?? 'construct'} size={20} color="white" />
    </View>
  );
}

function WorkDetails({ item }: { item: ServiceRequest }) {
  return (
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
      <View className="mt-2 gap-1">
        {(item.scheduled_date || item.scheduled_time) && (
          <Text className="text-xs text-gray-500">
            <Ionicons name="calendar-outline" size={11} color="#9CA3AF" /> {item.scheduled_date ?? 'Date TBD'} ·{' '}
            {item.scheduled_time ?? 'Time TBD'}
          </Text>
        )}
        {item.location_data?.address && (
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color="#9CA3AF" /> {item.location_data.address}
          </Text>
        )}
        {item.quoted_price != null && (
          <Text className="text-xs text-gray-500">
            <Ionicons name="cash-outline" size={11} color="#9CA3AF" /> NPR {Number(item.quoted_price).toLocaleString()}
          </Text>
        )}
      </View>
    </View>
  );
}

function NewJobCard({ item }: { item: ServiceRequest }) {
  return (
    <View className="mb-3 rounded-2xl border border-orange-100 bg-white p-4">
      <Pressable onPress={() => router.push(`/(technician)/job/${item.id}`)} className="flex-row items-start gap-3">
        <View className="items-center gap-1.5">
          <CategoryBadge category={item.issue_type} />
          <RequestPhotoThumb photoUrls={item.photo_urls} size={44} />
        </View>
        <WorkDetails item={item} />
      </Pressable>

      <Pressable
        onPress={() => router.push(`/(technician)/job/${item.id}`)}
        className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5"
      >
        <Ionicons name="checkmark-circle" size={16} color="white" />
        <Text className="text-sm font-semibold text-white">View &amp; Accept</Text>
      </Pressable>
    </View>
  );
}

function ContactRow({
  label,
  name,
  phone,
  bg,
}: {
  label: string;
  name: string | null | undefined;
  phone: string | null | undefined;
  bg: string;
}) {
  if (!name && !phone) return null;
  return (
    <View className="flex-row items-center gap-2">
      <PersonAvatar name={name} size={28} bg={bg} />
      <View>
        <Text className="text-[9.5px] font-semibold uppercase tracking-wide text-gray-400">{label}</Text>
        <Text className="text-xs font-semibold text-gray-700" numberOfLines={1}>
          {name ?? 'Unnamed'}
          {phone ? ` · ${phone}` : ''}
        </Text>
      </View>
    </View>
  );
}

function ActiveJobCard({ item }: { item: ServiceRequest }) {
  const needsCustomerLookup = !item.customer_name;
  const { data: customer } = useSupabaseRow('profiles', needsCustomerLookup ? item.client_id : undefined);
  const { data: reseller } = useSupabaseRow('profiles', item.reseller_id ?? undefined);

  const customerName = item.customer_name ?? customer?.full_name;
  const customerPhone = item.customer_phone ?? customer?.phone;

  return (
    <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
      <Pressable onPress={() => router.push(`/(technician)/job/${item.id}`)} className="flex-row items-start gap-3">
        <View className="items-center gap-1.5">
          <CategoryBadge category={item.issue_type} />
          <RequestPhotoThumb photoUrls={item.photo_urls} size={44} />
        </View>
        <WorkDetails item={item} />
      </Pressable>

      {(reseller || customerName || customerPhone) && (
        <View className="mt-3 flex-row flex-wrap gap-4 border-t border-gray-100 pt-3">
          <ContactRow label="Reseller" name={reseller?.full_name} phone={reseller?.phone} bg="bg-orange-500" />
          <ContactRow label="Customer" name={customerName} phone={customerPhone} bg="bg-teal-600" />
        </View>
      )}

      <Pressable
        onPress={() => router.push(`/(technician)/job/${item.id}`)}
        className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5"
      >
        <Text className="text-sm font-semibold text-white">View Job</Text>
        <Ionicons name="arrow-forward-circle" size={16} color="white" />
      </Pressable>
    </View>
  );
}

export default function TechnicianDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);

  const { data: jobs } = useSupabaseQuery('service_requests', {
    filters: userId ? { technician_id: userId } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!userId,
  });
  const { data: reviews } = useSupabaseQuery('reviews', {
    filters: userId ? { technician_id: userId } : {},
    enabled: !!userId,
  });

  const newJobs = useMemo(() => (jobs ?? []).filter((j) => j.status === 'assigned'), [jobs]);
  const activeJobs = useMemo(() => (jobs ?? []).filter((j) => j.status === 'in_progress'), [jobs]);
  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const totalActive = newJobs.length + activeJobs.length;

  return (
    <ScrollView className="flex-1 bg-gray-50 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="mb-1 text-2xl font-bold text-gray-900">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </Text>
      <Text className="mb-5 text-gray-500">
        {totalActive} active job{totalActive === 1 ? '' : 's'} right now
        {averageRating != null && ` · ★ ${averageRating.toFixed(1)}`}
      </Text>

      {totalActive === 0 && (
        <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
          <Ionicons name="briefcase-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">No jobs assigned yet.</Text>
          <Text className="text-xs text-gray-400">New assignments will show up here.</Text>
        </View>
      )}

      {newJobs.length > 0 && (
        <>
          <View className="mb-2.5 flex-row items-center gap-1.5">
            <Ionicons name="alert-circle" size={15} color="#F97316" />
            <Text className="text-[15px] font-bold text-gray-900">New assignment{newJobs.length === 1 ? '' : 's'}</Text>
          </View>
          {newJobs.map((job) => (
            <NewJobCard key={job.id} item={job} />
          ))}
        </>
      )}

      {activeJobs.length > 0 && (
        <>
          <View className="mb-2.5 mt-1 flex-row items-center gap-1.5">
            <Ionicons name="build" size={15} color="#2563EB" />
            <Text className="text-[15px] font-bold text-gray-900">In progress</Text>
          </View>
          {activeJobs.map((job) => (
            <ActiveJobCard key={job.id} item={job} />
          ))}
        </>
      )}
    </ScrollView>
  );
}
