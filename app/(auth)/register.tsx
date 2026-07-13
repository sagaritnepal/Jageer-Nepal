// app/(auth)/register.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/utils/alert';
import type { UserRole } from '../../types/database.types';

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Client', value: 'client' },
  { label: 'Technician', value: 'technician' },
  { label: 'Reseller', value: 'reseller' },
  { label: 'Wholesaler', value: 'wholesaler' },
];

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role)!;

  async function handleRegister() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    setIsSubmitting(false);

    if (error) {
      showAlert('Registration failed', error.message);
      return;
    }
    showAlert('Check your email', 'Confirm your account, then sign in.');
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

      <Text className="mb-1 text-sm font-medium text-gray-700">I am a…</Text>
      <View className="mb-6">
        <Pressable
          onPress={() => setShowRoleMenu((v) => !v)}
          className="flex-row items-center justify-between rounded-lg border border-gray-300 px-4 py-3"
        >
          <Text className="text-base text-gray-900">{selectedRole.label}</Text>
          <Text className="text-gray-400">{showRoleMenu ? '▲' : '▼'}</Text>
        </Pressable>
        {showRoleMenu && (
          <View className="mt-1 rounded-lg border border-gray-200 bg-white">
            {ROLES.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => {
                  setRole(r.value);
                  setShowRoleMenu(false);
                }}
                className="px-4 py-2.5"
              >
                <Text className={r.value === role ? 'font-semibold text-blue-700' : 'text-gray-700'}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
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
