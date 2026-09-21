// lib/components/PortalHeaderBar.tsx
import { View, Text, Image, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseUpdate } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';

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

// Moved here from the technician's Profile screen (that screen's own
// "My Status" row) so it's reachable from the dashboard header instead of
// a settings screen - same is_available field, same update call, same
// Switch styling; only where it's shown changed.
function AvailabilityToggle() {
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const updateProfile = useSupabaseUpdate('profiles');

  if (!profile) return null;

  async function toggleAvailable(is_available: boolean) {
    try {
      await updateProfile.mutateAsync({ id: profile!.id, values: { is_available } });
      setProfile({ ...profile!, is_available });
    } catch (err) {
      showAlert('Could not update', getErrorMessage(err));
    }
  }

  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-9 w-9 items-center justify-center rounded-full ${profile.is_available ? 'bg-green-50' : 'bg-gray-100'}`}>
        <Ionicons
          name={profile.is_available ? 'radio-button-on' : 'radio-button-off-outline'}
          size={17}
          color={profile.is_available ? '#16a34a' : '#9CA3AF'}
        />
      </View>
      <Switch
        value={!!profile.is_available}
        onValueChange={toggleAvailable}
        disabled={updateProfile.isPending}
        trackColor={{ false: '#D1D5DB', true: '#93c5fd' }}
        thumbColor={profile.is_available ? '#3b82f6' : '#F3F4F6'}
      />
    </View>
  );
}

export function PortalHeaderBar({ title, showAvailabilityToggle }: { title?: string; showAvailabilityToggle?: boolean }) {
  const profile = useAuthStore((state) => state.profile);
  const profileRoute = profile?.role ? PROFILE_ROUTE[profile.role] : undefined;
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 pb-2.5"
      style={{ paddingTop: insets.top + 16 }}
    >
      <Text className="flex-1 text-xl font-bold text-gray-900" numberOfLines={1}>
        {title ?? ''}
      </Text>
      {showAvailabilityToggle && profile?.role === 'technician' && <AvailabilityToggle />}
      <Pressable onPress={() => profileRoute && router.push(profileRoute as never)} hitSlop={8}>
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
