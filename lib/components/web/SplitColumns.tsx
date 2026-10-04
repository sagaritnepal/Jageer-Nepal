// lib/components/web/SplitColumns.tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useIsWideWeb } from '../../hooks/useWideGrid';

/** Two columns side by side on a wide screen, stacked (left, then right) on a
 * phone - where the phone order is the same as the page had before. A page
 * whose phone order interleaves the two sides builds its own layout instead. */
export function SplitColumns({
  left,
  right,
  leftFlex = 1,
  rightFlex = 1,
  gap = 24,
}: {
  left: ReactNode;
  right: ReactNode;
  leftFlex?: number;
  rightFlex?: number;
  gap?: number;
}) {
  const wide = useIsWideWeb();
  if (!wide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View className="flex-row items-start" style={{ gap }}>
      <View style={{ flex: leftFlex, minWidth: 0 }}>{left}</View>
      <View style={{ flex: rightFlex, minWidth: 0 }}>{right}</View>
    </View>
  );
}
