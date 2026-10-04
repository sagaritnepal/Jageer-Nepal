// lib/components/NotificationRow.tsx
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NOTIFICATION_TINT, notificationStyle } from '../constants/notificationKinds';
import { formatTimestamp } from '../utils/duration';
import type { AppNotification } from '../../types/database.types';

/** "5 min ago", "3 h ago", "2 days ago" - the exact time sits beside it. */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** One notification in a list: its icon, what happened, which job, and when.
 * An unread one is highlighted, with a tick to mark just that one as read;
 * tapping the row opens what it is about (and marks it read). */
export function NotificationRow({
  item,
  onPress,
  onMarkRead,
}: {
  item: AppNotification;
  onPress?: () => void;
  onMarkRead?: () => void;
}) {
  const unread = !item.read_at;
  const { icon, tone } = notificationStyle(item.kind);
  const tint = NOTIFICATION_TINT[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}`}
      className={`mb-3 flex-row items-start gap-3 rounded-2xl border p-4 ${
        unread ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tint.bg }}>
        <Ionicons name={icon} size={21} color={tint.fg} />
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className={`text-[14.5px] text-gray-900 ${unread ? 'font-bold' : 'font-semibold'}`}>{item.title}</Text>
        {!!item.body && (
          <Text className="text-[13px] text-gray-700" numberOfLines={2}>
            {item.body}
          </Text>
        )}
        <Text className="text-xs text-gray-500">
          {timeAgo(item.created_at)} · {formatTimestamp(item.created_at)}
        </Text>
      </View>
      {unread && onMarkRead ? (
        <Pressable
          onPress={onMarkRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mark as read"
          className="h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white active:bg-blue-100"
        >
          <Ionicons name="checkmark" size={17} color="#2563EB" />
        </Pressable>
      ) : (
        !!onPress && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginTop: 10 }} />
      )}
    </Pressable>
  );
}
