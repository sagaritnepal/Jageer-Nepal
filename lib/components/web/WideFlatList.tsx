// lib/components/web/WideFlatList.tsx
import { FlatList, View, type FlatListProps } from 'react-native';
import { useWideGrid } from '../../hooks/useWideGrid';

/** A FlatList that is one card per row on a phone, and on wide web lays the
 * same cards out in as many columns as fit at `cardWidth`, instead of each one
 * stretched across the page. Everything else is a plain FlatList. */
export function WideFlatList<T>({
  renderItem,
  cardWidth = 420,
  maxColumns = 3,
  ...rest
}: FlatListProps<T> & { cardWidth?: number; maxColumns?: number }) {
  const { wide, columns, containerProps, cellStyle } = useWideGrid({ cardWidth, minColumns: 1, maxColumns });

  return (
    <FlatList<T>
      // A FlatList cannot change its column count on the fly, so a new count
      // remounts it.
      key={wide ? columns : 1}
      numColumns={wide ? columns : 1}
      {...containerProps}
      {...rest}
      renderItem={(info) => {
        const element = renderItem ? renderItem(info) : null;
        return wide ? <View style={cellStyle}>{element}</View> : element;
      }}
    />
  );
}
