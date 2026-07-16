// lib/components/PortalHeaderBar.tsx
import { View, Text, Image } from 'react-native';
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

export function PortalHeaderBar() {
  const profile = useAuthStore((state) => state.profile);

  return (
    <View className="flex-row items-center justify-end gap-2 border-b border-gray-100 bg-white px-6 pb-2.5 pt-10">
      <Text className="max-w-[140px] text-sm font-medium text-gray-600" numberOfLines={1}>
        {profile?.full_name ?? ''}
      </Text>
      <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange-100">
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Text className="text-xs font-bold text-orange-700">{initialsOf(profile?.full_name)}</Text>
        )}
      </View>
    </View>
  );
}
