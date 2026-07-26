// lib/components/AppLogo.tsx
import { View, Text } from 'react-native';

export function AppLogo({ size = 44 }: { size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      className="items-center justify-center bg-orange-500"
    >
      <Text style={{ fontSize: size * 0.5 }} className="font-extrabold text-white">
        J
      </Text>
    </View>
  );
}
