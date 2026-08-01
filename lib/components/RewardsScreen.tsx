// lib/components/RewardsScreen.tsx
import { useState } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuth';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../utils/alert';

type Section = 'rewards' | 'refer' | 'redeem' | null;

function referralCodeFor(userId: string) {
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function SectionRow({
  icon,
  label,
  sub,
  open,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  open: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View className={`overflow-hidden rounded-2xl border border-orange-100 bg-white ${open ? '' : 'mb-2.5'}`}>
      <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3.5">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-orange-50">
          <Ionicons name={icon} size={18} color="#2563eb" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{label}</Text>
          <Text className="mt-0.5 text-xs text-gray-400">{sub}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-forward'} size={18} color="#9CA3AF" />
      </Pressable>
      {open && <View className="mb-2.5 border-t border-orange-50 px-4 pb-4 pt-3">{children}</View>}
    </View>
  );
}

export function RewardsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [openSection, setOpenSection] = useState<Section>(null);

  const { data: events } = useSupabaseQuery('reward_point_events', {
    filters: profile ? { user_id: profile.id } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!profile,
  });

  if (!profile) return null;

  const points = profile.reward_points ?? 0;
  const code = referralCodeFor(profile.id);

  function toggle(section: Section) {
    setOpenSection((cur) => (cur === section ? null : section));
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on Jageer Nepal! Use my code ${code} when you sign up.`,
      });
    } catch (err) {
      showAlert('Could not share', getErrorMessage(err));
    }
  }

  return (
    <View className="px-6 pt-5">
      <View className="mb-4 items-center rounded-2xl bg-orange-500 px-6 py-6">
        <Ionicons name="gift" size={28} color="white" />
        <Text className="mt-2 text-3xl font-extrabold text-white">{points}</Text>
        <Text className="mt-0.5 text-sm font-medium text-white/85">reward point{points === 1 ? '' : 's'}</Text>
      </View>

      <SectionRow
        icon="star"
        label="My Rewards"
        sub={points > 0 ? `${points} point${points === 1 ? '' : 's'} earned so far` : 'Complete tasks to start earning'}
        open={openSection === 'rewards'}
        onPress={() => toggle('rewards')}
      >
        {(events ?? []).length === 0 ? (
          <Text className="text-sm text-gray-500">No rewards yet.</Text>
        ) : (
          (events ?? []).map((e) => (
            <View key={e.id} className="mb-2 flex-row items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
              <View className="flex-1 pr-2">
                <Text className="text-sm font-medium text-gray-900">{e.reason}</Text>
                <Text className="text-xs text-gray-400">{dayLabel(e.created_at)}</Text>
              </View>
              <Text className="text-sm font-bold text-orange-600">+{e.points}</Text>
            </View>
          ))
        )}
      </SectionRow>

      <SectionRow
        icon="people"
        label="Refer & Earn"
        sub="Share your code with friends"
        open={openSection === 'refer'}
        onPress={() => toggle('refer')}
      >
        <Text className="mb-3 text-sm text-gray-500">
          Share your referral code with friends — you'll be able to earn points together here soon.
        </Text>
        <View className="mb-3 flex-row items-center justify-between rounded-xl border border-dashed border-orange-300 bg-orange-50 px-4 py-3">
          <Text className="text-lg font-extrabold tracking-wide text-orange-700">{code}</Text>
          <Ionicons name="pricetag-outline" size={18} color="#2563eb" />
        </View>
        <Pressable onPress={handleShare} className="items-center rounded-lg bg-orange-500 py-2.5">
          <Text className="text-sm font-semibold text-white">Share code</Text>
        </Pressable>
      </SectionRow>

      <SectionRow
        icon="pricetags"
        label="Redeem"
        sub="Coming soon"
        open={openSection === 'redeem'}
        onPress={() => toggle('redeem')}
      >
        <View className="items-center py-4">
          <Ionicons name="hourglass-outline" size={24} color="#D1D5DB" />
          <Text className="mt-2 text-sm text-gray-500">Redeeming points isn't available yet — stay tuned.</Text>
        </View>
      </SectionRow>
    </View>
  );
}
