// app/(auth)/login.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-1 text-3xl font-bold text-blue-700">Jageer Nepal</Text>
      <Text className="mb-8 text-gray-500">Sign in to continue</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3 text-base"
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        className="mb-6 rounded-lg border border-gray-300 px-4 py-3 text-base"
      />

      <Pressable
        onPress={handleLogin}
        disabled={isSubmitting}
        className="mb-4 items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Text>
      </Pressable>

      <Link href="/(auth)/register" className="text-center text-blue-700">
        Don't have an account? Register
      </Link>
    </View>
  );
}
