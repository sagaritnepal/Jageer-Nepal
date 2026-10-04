// lib/components/web/WideCardGrid.tsx
import { Children, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { useWideGrid } from '../../hooks/useWideGrid';

/** A stack of cards on a phone; on wide web the same cards in as many columns
 * as fit at `cardWidth`, instead of each one stretched across the page.
 *
 * Wrap the `.map(...)` of a list in this. The phone layout is untouched: the
 * cards are rendered exactly as before, straight into the parent. */
export function WideCardGrid({
  children,
  cardWidth = 400,
  minColumns = 1,
  maxColumns = 3,
}: {
  children: ReactNode;
  cardWidth?: number;
  minColumns?: number;
  maxColumns?: number;
}) {
  const { wide, containerProps, cellStyle } = useWideGrid({ cardWidth, minColumns, maxColumns });
  if (!wide) return <>{children}</>;

  return (
    <View className="flex-row flex-wrap" {...containerProps}>
      {Children.toArray(children).map((child, index) => (
        <View key={isValidElement(child) && child.key != null ? child.key : index} style={cellStyle}>
          {child}
        </View>
      ))}
    </View>
  );
}
