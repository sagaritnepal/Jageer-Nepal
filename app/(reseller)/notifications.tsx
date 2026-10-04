// app/(reseller)/notifications.tsx
import { useEffect, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/hooks/useAuth';
import { useIsWideWeb } from '../../lib/hooks/useWideGrid';
import { useNotifications } from '../../lib/hooks/useNotifications';
import { NotificationRow } from '../../lib/components/NotificationRow';
import { ReadableWidth } from '../../lib/components/web/ReadableWidth';

/** What has happened on the reseller's jobs lately, newest first: a technician
 * accepting, declining or finishing one, asking for a hold, recording a payment
 * or adding a chalan photo. Opening this page marks everything as read (the
 * bell's count clears), but the ones that were new stay highlighted while the
 * page is open. */
export default function ResellerNotifications() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useIsWideWeb();
  const { items, unread, loaded, markRead } = useNotifications(userId);

  // Everything that was unread when it was first seen on this page, so it stays
  // highlighted after markRead clears it in the database.
  const highlighted = useRef(new Set<string>());
  for (const item of items) if (!item.read_at) highlighted.current.add(item.id);

  useEffect(() => {
    if (loaded && unread > 0) markRead();
  }, [loaded, unread, markRead]);

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
              You will see it here, and as a pop-up, when a technician accepts a job, finishes it, records a payment and more.
            </Text>
          </View>
        )}

        {items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            isNew={highlighted.current.has(item.id)}
            onPress={item.request_id ? () => router.push(`/(reseller)/request/${item.request_id}` as any) : undefined}
          />
        ))}

        {items.length > 0 && <Text className="px-1 text-[11.5px] text-gray-400">Showing the last 30 days.</Text>}
      </ReadableWidth>
    </ScrollView>
  );
}
