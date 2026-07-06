// app/index.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/hooks/useAuth';
import { ROLE_ACCENT } from '../lib/constants/roleColors';

const ROLE_HOME: Record<string, string> = {
  client: '/(client)/dashboard',
  technician: '/(technician)/dashboard',
  reseller: '/(reseller)/dashboard',
  wholesaler: '/(wholesaler)/market',
  admin: '/(admin)/dashboard',
};

function Splash({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <View
      style={{ backgroundColor: ROLE_ACCENT.client }}
      className="flex-1 items-center justify-center gap-5 px-8"
    >
      <View className="h-20 w-20 items-center justify-center rounded-[22px] bg-white shadow-lg">
        <Text className="text-4xl font-extrabold" style={{ color: ROLE_ACCENT.client }}>
          J
        </Text>
      </View>
      <View className="items-center">
        <Text className="text-3xl font-extrabold text-white">Jageer</Text>
        <Text className="mt-1 text-sm font-medium text-white/85">One platform. Every IT need.</Text>
      </View>
      <Pressable onPress={onGetStarted} className="mt-6 rounded-full bg-white px-9 py-3.5">
        <Text className="text-base font-bold" style={{ color: ROLE_ACCENT.client }}>
          Get Started
        </Text>
      </Pressable>
    </View>
  );
}

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const [showSplash, setShowSplash] = useState(true);

  if (!session) {
    if (showSplash) {
      return <Splash onGetStarted={() => setShowSplash(false)} />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  // Session exists but profile hasn't loaded yet - the AuthGate's loading
  // state should normally prevent this, but guard anyway.
  if (!profile) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={(ROLE_HOME[profile.role] ?? '/(client)/dashboard') as never} />;
}
