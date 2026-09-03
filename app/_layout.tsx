// app/_layout.tsx
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuthListener, useAuthStore } from '../lib/hooks/useAuth';
import { useBiometricLockBootstrap, useBiometricLockStore } from '../lib/hooks/useBiometricLock';
import { useContactsSyncBootstrap } from '../lib/hooks/useContactsSyncBootstrap';
import { BiometricLockScreen } from '../lib/components/BiometricLockScreen';
import { FloatingAssistantChat } from '../lib/components/FloatingAssistantChat';
import { ClientAssistantChat } from '../lib/components/ClientAssistantChat';
import '../global.css';

// Pre-login screens (login/register) are still a bare mobile-first form
// with no width cap, so on a laptop browser it'd stretch edge-to-edge - a
// full-viewport-wide email box, buttons a foot long. This letterboxes just
// those into a fixed-width column on wide viewports (a phone-app look, like
// WhatsApp Web). Once signed in, each role's own layout takes over width
// management via WebSidebarShell instead (a real sidebar + content column,
// not a centered phone screen), so this only wraps the pre-login state -
// see RootLayout. Native mobile is untouched either way - the cap only
// ever matters when the viewport is wider than it, which never happens on
// an actual phone.
const WEB_MAX_WIDTH = 640;

function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#E5E7EB', alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: WEB_MAX_WIDTH,
          backgroundColor: '#fff',
          boxShadow: '0 0 24px rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  useAuthListener();
  const isLoading = useAuthStore((state) => state.isLoading);
  const userId = useAuthStore((state) => state.session?.user.id);

  useBiometricLockBootstrap(userId);
  const role = useAuthStore((state) => state.profile?.role);
  useContactsSyncBootstrap(role === 'reseller' || role === 'wholesaler' ? userId : undefined);
  const biometricEnabled = useBiometricLockStore((state) => state.enabled);
  const biometricLocked = useBiometricLockStore((state) => state.locked);
  const biometricChecked = useBiometricLockStore((state) => state.checked);

  if (isLoading || (userId && !biometricChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (userId && biometricEnabled && biometricLocked) {
    return <BiometricLockScreen />;
  }

  // Floats over every screen - Finance actions for reseller/wholesaler
  // accounts, booking a service request for client accounts. Same "Sagar"
  // photo/branding either way, just a different conversation and a
  // different form it hands off to.
  const showFinanceAssistant = userId && (role === 'reseller' || role === 'wholesaler');
  const showClientAssistant = userId && role === 'client';

  // Signed-in role layouts manage their own web width (WebSidebarShell);
  // only the pre-login state gets the generic centered letterbox.
  const content = userId ? <>{children}</> : <WebFrame>{children}</WebFrame>;

  return (
    <>
      {content}
      {showFinanceAssistant && <FloatingAssistantChat basePath={`/(${role})`} />}
      {showClientAssistant && <ClientAssistantChat basePath="/(client)" />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <QueryProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(client)" />
            <Stack.Screen name="(technician)" />
            <Stack.Screen name="(reseller)" />
            <Stack.Screen name="(wholesaler)" />
            <Stack.Screen name="(admin)" />
          </Stack>
        </AuthGate>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
