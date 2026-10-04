// app/(reseller)/notifications.tsx
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useSupabaseRow } from '../../lib/hooks/useSupabase';
import { useIsWideWeb } from '../../lib/hooks/useWideGrid';
import { useResellerNotifications, type AcceptedJob } from '../../lib/hooks/useResellerNotifications';
import { CategoryBadge } from '../../lib/components/CategoryBadge';
import { ReadableWidth } from '../../lib/components/web/ReadableWidth';
import { formatTimestamp } from '../../lib/utils/duration';

/** "5 min ago", "3 h ago", "2 days ago" - the exact time sits beside it. */
function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function NotificationRow({ job, isNew }: { job: AcceptedJob; isNew: boolean }) {
  const { data: technician } = useSupabaseRow('profiles', job.technicianId);
  const name = technician?.full_name ?? 'A technician';

  return (
    <Pressable
      onPress={() => router.push(`/(reseller)/request/${job.requestId}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${name} accepted ${job.issueType}`}
      className={`mb-3 flex-row items-start gap-3 rounded-2xl border p-4 ${
        isNew ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <CategoryBadge category={job.issueType} />
      <View className="flex-1" style={{ gap: 2 }}>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
          <Text className="flex-1 text-[14.5px] font-bold text-gray-900">{name} accepted a job</Text>
          {isNew && <View className="h-2 w-2 rounded-full bg-blue-600" />}
        </View>
        <Text className="text-[13px] text-gray-700" numberOfLines={2}>
          {job.issueType}
        </Text>
        <Text className="text-xs text-gray-500">
          {timeAgo(job.at)} · {formatTimestamp(job.at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </Pressable>
  );
}

/** What has happened on the reseller's jobs lately: a technician accepting one.
 * Opening this page marks everything as seen (the bell's count clears), but the
 * ones that were new stay highlighted while the page is open. */
export default function ResellerNotifications() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useIsWideWeb();
  const { items, seenAt, loaded, markSeen } = useResellerNotifications(userId);

  // The seen time as it was when the page opened, so the new ones stay marked
  // even after markSeen moves it forward.
  const seenOnOpen = useRef<string | null>(null);
  if (loaded && seenOnOpen.current === null && seenAt) seenOnOpen.current = seenAt;

  useEffect(() => {
    if (loaded) markSeen();
  }, [loaded, markSeen]);

  const baseline = seenOnOpen.current ? new Date(seenOnOpen.current).getTime() : Infinity;

  return (
    <ScrollView
      className={wide ? 'flex-1 bg-gray-50 px-8 pt-5' : 'flex-1 bg-gray-50 px-6 pt-4'}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <ReadableWidth maxWidth={720}>
        {loaded && items.length === 0 && (
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-12" style={{ gap: 6 }}>
            <Ionicons name="notifications-outline" size={30} color="#D1D5DB" />
            <Text className="mt-1 text-gray-600">No notifications yet.</Text>
            <Text className="px-6 text-center text-xs text-gray-500">
              You will see it here, and as a pop-up, when a technician accepts one of your jobs.
            </Text>
          </View>
        )}

        {items.map((job) => (
          <NotificationRow key={job.id} job={job} isNew={new Date(job.at).getTime() > baseline} />
        ))}

        {items.length > 0 && <Text className="px-1 text-[11.5px] text-gray-400">Showing the last 7 days.</Text>}
      </ReadableWidth>
    </ScrollView>
  );
}
