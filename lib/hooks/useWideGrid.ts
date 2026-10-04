// lib/hooks/useWideGrid.ts
import { useState } from 'react';
import { Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { WEB_SIDEBAR_MIN_WIDTH } from '../components/web/WebSidebarShell';

const WIDE_GRID_GAP = 16;

/** Card grids and lists are one column (or two product cards) on a phone. On
 * wide web this gives as many columns as fit at `cardWidth`, measured from the
 * grid itself so it follows whatever width the page column ends up with.
 *
 * Spread `containerProps` on the wrapping row (or the FlatList - it measures
 * the grid and pulls the outer edges back out), and give each card's cell
 * `cellStyle`. A FlatList also wants `numColumns={columns}` and
 * `key={columns}`. When `wide` is false, render the plain phone layout. */
export function useWideGrid({
  cardWidth = 220,
  minColumns = 2,
  maxColumns = 8,
}: { cardWidth?: number; minColumns?: number; maxColumns?: number } = {}) {
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const wide = Platform.OS === 'web' && windowWidth >= WEB_SIDEBAR_MIN_WIDTH;
  const columns = Math.min(maxColumns, Math.max(minColumns, Math.floor(gridWidth / (cardWidth + WIDE_GRID_GAP))));

  return {
    wide,
    columns,
    containerProps: {
      onLayout: (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width),
      // Each cell pads half the gap on both sides; this pulls the outer edges
      // back out so the grid still lines up with the page.
      style: wide ? { marginHorizontal: -WIDE_GRID_GAP / 2 } : undefined,
    },
    cellStyle: { width: `${100 / columns}%` as `${number}%`, paddingHorizontal: WIDE_GRID_GAP / 2 },
  };
}
