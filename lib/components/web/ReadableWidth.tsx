// lib/components/web/ReadableWidth.tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useIsWideWeb } from '../../hooks/useWideGrid';

/** For a short form or a single card: on a wide screen it keeps a normal
 * width, left-aligned beside the sidebar, instead of one text box running the
 * whole way across the page. On a phone it renders its children untouched. */
export function ReadableWidth({ children, maxWidth = 640 }: { children: ReactNode; maxWidth?: number }) {
  const wide = useIsWideWeb();
  if (!wide) return <>{children}</>;
  return <View style={{ width: '100%', maxWidth }}>{children}</View>;
}
