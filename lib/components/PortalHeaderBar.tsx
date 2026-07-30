// lib/components/PortalHeaderBar.tsx
import { View, Text, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../hooks/useAuth';

function initialsOf(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const PROFILE_ROUTE: Record<string, string> = {
  client: '/(client)/profile',
  technician: '/(technician)/profile',
  reseller: '/(reseller)/profile',
  wholesaler: '/(wholesaler)/profile',
  admin: '/(admin)/profile',
};

export function PortalHeaderBar({ title }: { title?: string }) {
  const profile = useAuthStore((state) => state.profile);
  const profileRoute = profile?.role ? PROFILE_ROUTE[profile.role] : undefined;
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between gap-2 border-b border-gray-100 bg-white px-6 pb-2.5"
      style={{ paddingTop: insets.top + 16 }}
    >
      <Text className="flex-1 text-xl font-bold text-gray-900" numberOfLines={1}>
        {title ?? ''}
      </Text>
      <Pressable
        onPress={() => profileRoute && router.push(profileRoute as never)}
        hitSlop={8}
        className="flex-row items-center gap-2"
      >
        <Text className="max-w-[140px] text-sm font-medium text-gray-600" numberOfLines={1}>
          {profile?.full_name ?? ''}
        </Text>
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-orange-100">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-xs font-bold text-orange-700">{initialsOf(profile?.full_name)}</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}
