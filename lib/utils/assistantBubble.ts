// lib/utils/assistantBubble.ts
import { Platform } from 'react-native';
import { WEB_SIDEBAR_MIN_WIDTH } from '../components/web/WebSidebarShell';

// The bottom tab bar's usual height (icon plus label), without the device's
// safe-area inset. The floating assistant has to start above it.
const TAB_BAR_HEIGHT = 56;
const EDGE_GAP = 16;

/** Where the floating assistant bubble sits until it is dragged: bottom-left,
 * just above the bottom tab bar on a phone (it used to sit on top of the first
 * tab), and bottom-right on a wide web screen, away from the sidebar. */
export function assistantStartPosition({
  screenWidth,
  screenHeight,
  insetBottom,
  size,
}: {
  screenWidth: number;
  screenHeight: number;
  insetBottom: number;
  size: number;
}): { x: number; y: number } {
  const wideWeb = Platform.OS === 'web' && screenWidth >= WEB_SIDEBAR_MIN_WIDTH;
  if (wideWeb) {
    return { x: screenWidth - size - 24, y: screenHeight - size - 24 };
  }
  return { x: EDGE_GAP, y: screenHeight - insetBottom - TAB_BAR_HEIGHT - size - EDGE_GAP };
}
