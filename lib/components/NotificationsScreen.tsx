// lib/components/NotificationsScreen.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../hooks/useAuth';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { useNotifications } from '../hooks/useNotifications';
import { notificationHref, type NotificationPortal } from '../constants/notificationKinds';
import { showAlert } from '../utils/alert';
import { NotificationRow } from './NotificationRow';
import { PushSettingsCard } from './PushSettingsCard';
import { ReadableWidth } from './web/ReadableWidth';

/** Everyone's notification inbox, newest first: the same list for a customer,
 * a reseller and a technician (`portal` only decides where a tap goes).
 *
 * Nothing is marked read just by looking: tap one to open it (that marks it),
 * tick one to mark only that, or "Mark all read". "Clear all" empties the list. */
export function NotificationsScreen({ portal, emptyHint }: { portal: NotificationPortal; emptyHint: string }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const wide = useIsWideWeb();
  const { items, unread, loaded, failed, markRead, clearAll } = useNotifications(userId);

  function confirmClearAll() {
    showAlert('Clear all notifications?', 'This empties your list. It cannot be undone.', [
      { text: 'Keep them', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => clearAll() },
    ]);
  }

  const action = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, disabled?: boolean, danger?: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="h-9 flex-row items-center justify-center gap-1.5 rounded-lg border bg-white px-3 disabled:opacity-40"
      style={{ borderColor: danger ? '#FECACA' : '#D1D5DB' }}
    >
      <Ionicons name={icon} size={15} color={danger ? '#DC2626' : '#374151'} />
      <Text className="text-[12.5px] font-semibold" style={{ color: danger ? '#DC2626' : '#374151' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      className={wide ? 'flex-1 bg-gray-50 px-8 pt-5' : 'flex-1 bg-gray-50 px-6 pt-4'}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <ReadableWidth maxWidth={720}>
        <PushSettingsCard />

        {items.length > 0 && (
          <View className="mb-3 flex-row flex-wrap items-center justify-between" style={{ gap: 8 }}>
            <Text className="text-[13px] font-semibold text-gray-600">
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </Text>
            <View className="flex-row" style={{ gap: 8 }}>
              {action('Mark all read', 'checkmark-done', () => markRead(), unread === 0)}
              {action('Clear all', 'trash-outline', confirmClearAll, false, true)}
            </View>
          </View>
        )}

        {loaded && items.length === 0 && (
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-12" style={{ gap: 6 }}>
            <Ionicons name="notifications-outline" size={30} color="#D1D5DB" />
            <Text className="mt-1 text-gray-600">No notifications yet.</Text>
            <Text className="px-6 text-center text-xs text-gray-500">{emptyHint}</Text>
          </View>
        )}

        {!loaded && failed && (
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-12" style={{ gap: 6 }}>
            <Ionicons name="cloud-offline-outline" size={30} color="#D1D5DB" />
            <Text className="mt-1 text-gray-600">Notifications could not be loaded.</Text>
            <Text className="px-6 text-center text-xs text-gray-500">Check your connection and try again in a moment.</Text>
          </View>
        )}

        {items.map((item) => {
          const href = notificationHref(item, portal);
          return (
            <NotificationRow
              key={item.id}
              item={item}
              onMarkRead={() => markRead([item.id])}
              onPress={
                href
                  ? () => {
                      if (!item.read_at) markRead([item.id]);
                      router.push(href as any);
                    }
                  : undefined
              }
            />
          );
        })}

        {items.length > 0 && <Text className="px-1 text-[11.5px] text-gray-400">Showing the last 30 days.</Text>}
      </ReadableWidth>
    </ScrollView>
  );
}
