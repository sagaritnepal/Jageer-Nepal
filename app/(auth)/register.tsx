// app/(auth)/register.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { UserRole } from '../../types/database.types';

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Client', value: 'client' },
  { label: 'Technician', value: 'technician' },
  { label: 'Reseller', value: 'reseller' },
];

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Registration failed', error.message);
      return;
    }
    Alert.alert('Check your email', 'Confirm your account, then sign in.');
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <Text className="mb-1 text-3xl font-bold text-blue-700">Create account</Text>
      <Text className="mb-8 text-gray-500">Join Jageer Nepal</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Full name</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Your name"
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3 text-base"
      />

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
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3 text-base"
      />

      <Text className="mb-2 text-sm font-medium text-gray-700">I am a…</Text>
      <View className="mb-6 flex-row gap-2">
        {ROLES.map((r) => (
          <Pressable
            key={r.value}
            onPress={() => setRole(r.value)}
            className={`flex-1 items-center rounded-lg border py-2 ${
              role === r.value ? 'border-blue-700 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <Text className={role === r.value ? 'font-semibold text-blue-700' : 'text-gray-600'}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleRegister}
        disabled={isSubmitting}
        className="mb-4 items-center rounded-lg bg-blue-700 py-3 disabled:opacity-50"
      >
        <Text className="text-base font-semibold text-white">
          {isSubmitting ? 'Creating account…' : 'Register'}
        </Text>
      </Pressable>

      <Link href="/(auth)/login" className="text-center text-blue-700">
        Already have an account? Sign in
      </Link>
    </ScrollView>
  );
}
