// app/index.tsx
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
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
    <View className="flex-1 items-center justify-center gap-6 bg-slate-50 px-8">
      <Image
        source={require('../assets/jageer-logo.png')}
        style={{ width: 260, height: 260 * (1238 / 900) }}
        resizeMode="contain"
      />
      <View className="items-center">
        <Text className="text-3xl font-extrabold text-gray-900">Jageer Nepal</Text>
        <Text className="mt-1 text-sm font-medium text-gray-500">One platform. Every IT need.</Text>
      </View>
      <Pressable
        onPress={onGetStarted}
        className="mt-4 rounded-full px-9 py-3.5"
        style={{ backgroundColor: ROLE_ACCENT.client }}
      >
        <Text className="text-base font-bold text-white">Get Started</Text>
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
