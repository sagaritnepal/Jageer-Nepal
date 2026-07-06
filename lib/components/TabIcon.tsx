// lib/components/TabIcon.tsx
import { Text } from 'react-native';

export function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}
