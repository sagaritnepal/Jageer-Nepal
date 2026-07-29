// app/(auth)/register.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../lib/components/AppLogo';
import { showAlert } from '../../lib/utils/alert';
import type { UserRole } from '../../types/database.types';

const ROLES: { label: string; value: UserRole; desc: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Wholesaler', value: 'wholesaler', desc: 'Supply products in bulk to resellers', color: '#3b82f6', icon: 'cube' },
  { label: 'Reseller', value: 'reseller', desc: 'Buy wholesale, sell to customers', color: '#7C3AED', icon: 'storefront' },
  { label: 'Technician', value: 'technician', desc: 'Get assigned service & install jobs', color: '#D97706', icon: 'construct' },
  { label: 'Client', value: 'client', desc: 'Order products & book services', color: '#059669', icon: 'person' },
];

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
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
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64 }}>
      <View className="mb-5 items-center">
        <AppLogo size={100} />
      </View>
      <Text className="mb-1.5 text-center text-2xl font-extrabold text-gray-900">Choose how you'll use Jageer</Text>
      <Text className="mb-5 text-center text-sm text-gray-500">You can add more roles later from Settings.</Text>

      <View className="mb-6 gap-2.5">
        {ROLES.map((r) => {
          const selected = r.value === role;
          return (
            <Pressable
              key={r.value}
              onPress={() => setRole(r.value)}
              className="flex-row items-center gap-3.5 rounded-2xl border-[1.5px] bg-white p-4"
              style={{
                borderColor: selected ? r.color : '#E5E7EB',
                shadowColor: selected ? r.color : undefined,
                shadowOpacity: selected ? 0.15 : 0,
                shadowRadius: selected ? 6 : 0,
              }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${r.color}1A` }}
              >
                <Ionicons name={r.icon} size={19} color={r.color} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-gray-900">{r.label}</Text>
                <Text className="mt-0.5 text-xs text-gray-500">{r.desc}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={20} color={r.color} />}
            </Pressable>
          );
        })}
      </View>

      <Text className="mb-1.5 text-xs font-semibold text-gray-500">Full name</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Your name"
        placeholderTextColor="#9CA3AF"
        className="mb-3.5 rounded-xl border-[1.5px] border-gray-200 px-4 py-3.5 text-sm text-gray-900"
      />

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
        onPress={handleRegister}
        disabled={isSubmitting}
        className="mb-4 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
      >
        <Text className="text-[15px] font-bold text-white">
          {isSubmitting ? 'Creating account…' : `Continue as ${selectedRole.label}`}
        </Text>
      </Pressable>

      <Link href="/(auth)/login" className="text-center text-[12.5px] text-gray-500">
        Already have an account? <Text className="font-bold text-orange-600">Sign in</Text>
      </Link>
    </ScrollView>
  );
}
