// lib/components/TabIcon.tsx
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

export function TabIcon({
  name,
  color,
  focused,
}: {
  name: IoniconName;
  color?: ColorValue;
  focused?: boolean;
}) {
  const resolvedName = focused ? name : ((`${name}-outline`) as IoniconName);
  return <Ionicons name={resolvedName} size={22} color={color as string} />;
}
