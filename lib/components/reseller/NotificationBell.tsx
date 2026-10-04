// lib/components/reseller/NotificationBell.tsx
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';

/** The notification bell in a reseller's header: opens their notifications -
 * what technicians have done on their jobs - and shows how many are unread.
 * The bell fills in and turns blue while there are some. */
export function ResellerNotificationBell() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { unread } = useNotifications(userId);

  return (
    <Pressable
      onPress={() => router.push('/(reseller)/notifications')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
      className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
    >
      <Ionicons
        name={unread > 0 ? 'notifications' : 'notifications-outline'}
        size={19}
        color={unread > 0 ? '#2563EB' : '#374151'}
      />
      {unread > 0 && (
        <View
          className="absolute items-center justify-center rounded-full bg-blue-600"
          style={{ top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderWidth: 2, borderColor: '#ffffff' }}
        >
          <Text className="text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
