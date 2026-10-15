// app/index.tsx
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore, loadProfileWithRetry } from '../lib/hooks/useAuth';
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
        style={{ width: 260, height: 260 * (1650 / 1354) }}
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
  const profileError = useAuthStore((state) => state.profileError);
  const [showSplash, setShowSplash] = useState(true);

  if (!session) {
    if (showSplash) {
      return <Splash onGetStarted={() => setShowSplash(false)} />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  // Session exists but profile hasn't loaded yet. useAuthListener sets
  // isLoading=false in the same tick it kicks off the (async) profile
  // fetch, so there's a real window - on every cold start/page refresh,
  // not just rarely - where session is restored but profile is still
  // null. Redirecting to login here (the old behavior) is what forced a
  // fresh login on every web refresh despite a perfectly valid session;
  // show a loading state instead and let the effect above re-render once
  // the profile arrives.
  if (!profile && profileError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
        <Text className="text-center text-base font-semibold text-gray-900">We could not load your account.</Text>
        <Text className="text-center text-sm text-gray-500">Check your connection and try again.</Text>
        <Pressable
          onPress={() => loadProfileWithRetry(session.user.id)}
          className="rounded-full px-8 py-3"
          style={{ backgroundColor: ROLE_ACCENT.client }}
        >
          <Text className="font-bold text-white">Try Again</Text>
        </Pressable>
        <Pressable onPress={() => useAuthStore.getState().signOut()}>
          <Text className="text-sm font-semibold text-gray-500">Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return <Redirect href={(ROLE_HOME[profile.role] ?? '/(client)/dashboard') as never} />;
}
