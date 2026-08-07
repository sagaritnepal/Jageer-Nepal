// app/(auth)/login.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, ScrollView, Platform, Keyboard } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../lib/components/AppLogo';
import { showAlert } from '../../lib/utils/alert';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // On some Android devices KeyboardAvoidingView's automatic resize doesn't
  // kick in (edge-to-edge layouts can make its measurement unreliable), so
  // track the keyboard's real height directly and pad the scroll content by
  // that amount - that guarantees the fields stay reachable by scrolling.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function handleLogin() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      showAlert('Login failed', error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 items-center">
          <AppLogo size={140} />
        </View>
        <Text className="text-center text-2xl font-extrabold text-gray-900">Welcome back</Text>
        <Text className="mb-7 mt-1.5 text-center text-sm text-gray-500">Sign in to your Jageer account</Text>

        <Text className="mb-1.5 text-xs font-semibold text-gray-500">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          className="mb-3.5 rounded-xl border-[1.5px] border-gray-200 px-4 py-3.5 text-sm text-gray-900"
        />

        <Text className="mb-1.5 text-xs font-semibold text-gray-500">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          className="mb-6 rounded-xl border-[1.5px] border-gray-200 px-4 py-3.5 text-sm text-gray-900"
        />

        <Pressable
          onPress={handleLogin}
          disabled={isSubmitting}
          className="mb-4 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
        >
          <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Link href="/(auth)/register" className="text-center text-[12.5px] text-gray-500">
          New to Jageer? <Text className="font-bold text-orange-600">Create account</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
