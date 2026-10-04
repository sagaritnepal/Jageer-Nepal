// lib/components/PushSettingsCard.tsx
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';

/** "Get notifications on this phone": the switch for push notifications - the
 * ones that arrive when the app is closed. Shows what is needed from the person
 * for wherever they are: turn it on, add the site to the Home Screen first (an
 * iPhone browser tab), or unblock it in settings. Hidden where push cannot work.
 * `hideWhenOn` lets a screen show it only while there is something to do. */
export function PushSettingsCard({ hideWhenOn }: { hideWhenOn?: boolean }) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { status, busy, error, enable, disable } = usePushNotifications(userId);

  if (status === 'checking' || status === 'unsupported') return null;
  if (status === 'on' && hideWhenOn) return null;

  if (status === 'on') {
    return (
      <View className="mb-3 flex-row items-center gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
        <Ionicons name="notifications" size={18} color="#16A34A" />
        <Text className="flex-1 text-[13px] font-semibold text-green-800">Notifications are on for this device</Text>
        <Pressable onPress={disable} disabled={busy} hitSlop={8} accessibilityRole="button" className="py-1 disabled:opacity-50">
          <Text className="text-[12.5px] font-semibold text-green-700">{busy ? 'Turning off…' : 'Turn off'}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'needs-install') {
    return (
      <View className="mb-3 flex-row items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <Ionicons name="phone-portrait-outline" size={20} color="#2563EB" style={{ marginTop: 1 }} />
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-[14px] font-bold text-gray-900">Get notifications on your iPhone</Text>
          <Text className="text-[12.5px] leading-[18px] text-gray-600">
            Tap the Share button in Safari, choose "Add to Home Screen", then open Jageer from your Home Screen and come
            back here to turn them on.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'blocked') {
    return (
      <View className="mb-3 flex-row items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Ionicons name="notifications-off-outline" size={20} color="#B45309" style={{ marginTop: 1 }} />
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-[14px] font-bold text-gray-900">Notifications are blocked</Text>
          <Text className="text-[12.5px] leading-[18px] text-gray-600">
            Allow notifications for Jageer in your browser or phone settings, then open this page again.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <View className="flex-row items-start gap-3">
        <Ionicons name="notifications-outline" size={20} color="#2563EB" style={{ marginTop: 1 }} />
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-[14px] font-bold text-gray-900">Get notifications on this device</Text>
          <Text className="text-[12.5px] leading-[18px] text-gray-600">
            Hear about new jobs, quotes and updates even when the app is closed.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={enable}
        disabled={busy}
        accessibilityRole="button"
        className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 disabled:opacity-60"
      >
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="notifications" size={16} color="#FFFFFF" />}
        <Text className="text-[13.5px] font-semibold text-white">{busy ? 'Turning on…' : 'Turn on notifications'}</Text>
      </Pressable>
      {!!error && <Text className="mt-2 text-[12px] text-red-600">{error}</Text>}
    </View>
  );
}
