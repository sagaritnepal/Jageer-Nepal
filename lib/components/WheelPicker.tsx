// lib/components/WheelPicker.tsx
import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
const PADDING = (ITEM_HEIGHT * (VISIBLE_COUNT - 1)) / 2;
const SETTLE_DELAY = 120;

/**
 * A single scrollable, snap-to-item wheel column (like a native iOS/Android
 * picker wheel) built from RN primitives so it renders identically on web,
 * iOS, and Android instead of relying on each platform's own native widget.
 *
 * Snapping is driven by a debounced `onScroll` rather than
 * onMomentumScrollEnd/onScrollEndDrag: those only fire for touch-drag
 * gestures on react-native-web, so a plain mouse-wheel scroll (how most
 * desktop/web users will actually interact with this) would never snap.
 */
export function WheelColumn({
  options,
  value,
  onChange,
  width = 80,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  // `contentOffset` isn't reliably applied by react-native-web on first
  // paint, so set the initial scroll position imperatively instead.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snapToIndex(rawIndex: number) {
    const clamped = Math.min(Math.max(rawIndex, 0), options.length - 1);
    onChange(options[clamped]);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => snapToIndex(Math.round(offsetY / ITEM_HEIGHT)), SETTLE_DELAY);
  }

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_COUNT, width, position: 'relative', overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PADDING,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: '#d1d5db',
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: PADDING }}
        onScroll={handleScroll}
      >
        {options.map((option, index) => (
          <View key={option} style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: index === selectedIndex ? 18 : 16,
                fontWeight: index === selectedIndex ? '700' : '400',
                color: index === selectedIndex ? '#111827' : '#9CA3AF',
              }}
            >
              {option}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
