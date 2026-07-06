// app/_layout.tsx
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuthListener, useAuthStore } from '../lib/hooks/useAuth';
import '../global.css';

function AuthGate({ children }: { children: React.ReactNode }) {
  useAuthListener();
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(client)" />
          <Stack.Screen name="(technician)" />
          <Stack.Screen name="(reseller)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </AuthGate>
    </QueryProvider>
  );
}
