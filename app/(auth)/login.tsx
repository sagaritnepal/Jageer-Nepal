// app/(auth)/login.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, ScrollView, Platform, Keyboard } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../lib/components/AppLogo';
import { showAlert, getErrorMessage } from '../../lib/utils/alert';
import { isBiometricHardwareReady, authenticateWithBiometrics } from '../../lib/utils/biometric';
import {
  hasBiometricCredentials,
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,
} from '../../lib/utils/biometricLogin';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [hasCreds, hardwareReady] = await Promise.all([hasBiometricCredentials(), isBiometricHardwareReady()]);
      setShowBiometricButton(hasCreds && hardwareReady);
    })();
  }, []);

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

  // showAlert (RN's Alert.alert) doesn't return a promise - it fires the
  // dialog and returns immediately, well before the user taps anything.
  // Wrapping it lets the caller actually wait for the user's choice instead
  // of racing ahead (see handleLogin, which used to navigate away before
  // this alert's "Enable" handler had a chance to run).
  async function offerBiometricSignIn(loggedInEmail: string, loggedInPassword: string): Promise<void> {
    const [hasCreds, hardwareReady] = await Promise.all([hasBiometricCredentials(), isBiometricHardwareReady()]);
    if (hasCreds || !hardwareReady) return;
    await new Promise<void>((resolve) => {
      showAlert('Sign in with fingerprint next time?', 'Skip typing your password on this device.', [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              const verified = await authenticateWithBiometrics();
              if (!verified) {
                showAlert('Not enabled', "Fingerprint wasn't verified, so this wasn't turned on. You can try again next time you log in.");
                return;
              }
              await saveBiometricCredentials(loggedInEmail, loggedInPassword);
              showAlert('Fingerprint sign-in enabled', "You'll be able to use it next time.");
            } catch (err) {
              showAlert('Could not enable fingerprint sign-in', getErrorMessage(err));
            } finally {
              resolve();
            }
          },
        },
      ]);
    });
  }

  async function handleLogin() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      showAlert('Login failed', error.message);
      return;
    }
    await offerBiometricSignIn(email, password);
    router.replace('/');
  }

  async function handleBiometricLogin() {
    setBiometricBusy(true);
    try {
      // Checked before the scan (not just at screen-mount time) so a stale
      // button never wastes a fingerprint scan on credentials that are
      // already gone - and so we can tell the two failure modes apart.
      const creds = await getBiometricCredentials();
      if (!creds) {
        setShowBiometricButton(false);
        showAlert('Fingerprint sign-in unavailable', 'Sign in with your password to set it up again.');
        return;
      }
      const verified = await authenticateWithBiometrics();
      if (!verified) {
        showAlert('Fingerprint not recognized', 'Try again, or sign in with your password below.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword(creds);
      if (error) {
        // The saved password no longer works (changed elsewhere, etc.) -
        // clear it so this doesn't keep failing the same way every time.
        await clearBiometricCredentials();
        setShowBiometricButton(false);
        showAlert('Sign-in failed', `${error.message} Sign in with your password to set up fingerprint sign-in again.`);
        return;
      }
      router.replace('/');
    } catch (err) {
      showAlert('Could not sign in', getErrorMessage(err));
    } finally {
      setBiometricBusy(false);
    }
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

        <View className="mb-4 flex-row gap-2.5">
          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            className="flex-1 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
          >
            <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
          {showBiometricButton && (
            <Pressable
              onPress={handleBiometricLogin}
              disabled={biometricBusy}
              className="items-center justify-center rounded-xl border-[1.5px] border-orange-500 px-4 py-3.5 disabled:opacity-50"
            >
              <Ionicons name="finger-print" size={22} color="#f97316" />
            </Pressable>
          )}
        </View>

        <Link href="/(auth)/register" className="text-center text-[12.5px] text-gray-500">
          New to Jageer? <Text className="font-bold text-orange-600">Create account</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
