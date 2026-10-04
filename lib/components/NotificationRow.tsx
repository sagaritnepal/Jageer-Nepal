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
 * `isNew` highlights it (unread, or unread when the page was opened). */
export function NotificationRow({
  item,
  isNew,
  onPress,
}: {
  item: AppNotification;
  isNew: boolean;
  onPress?: () => void;
}) {
  const { icon, tone } = notificationStyle(item.kind);
  const tint = NOTIFICATION_TINT[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={item.title}
      className={`mb-3 flex-row items-start gap-3 rounded-2xl border p-4 ${
        isNew ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tint.bg }}>
        <Ionicons name={icon} size={21} color={tint.fg} />
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <View className="flex-row items-center gap-1.5">
          <Text className="flex-1 text-[14.5px] font-bold text-gray-900">{item.title}</Text>
          {isNew && <View className="h-2 w-2 rounded-full bg-blue-600" />}
        </View>
        {!!item.body && (
          <Text className="text-[13px] text-gray-700" numberOfLines={2}>
            {item.body}
          </Text>
        )}
        <Text className="text-xs text-gray-500">
          {timeAgo(item.created_at)} · {formatTimestamp(item.created_at)}
        </Text>
      </View>
      {!!onPress && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginTop: 10 }} />}
    </Pressable>
  );
}
