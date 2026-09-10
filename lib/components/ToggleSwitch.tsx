// lib/components/ToggleSwitch.tsx
import { View } from 'react-native';

/** Small iOS-style switch, drawn (not the native Switch) so it looks the same
 * on web and native. Purely visual - wrap it in a Pressable to toggle. */
export function ToggleSwitch({ on, color }: { on: boolean; color: string }) {
  return (
    <View
      style={{
        width: 30,
        height: 17,
        borderRadius: 999,
        backgroundColor: on ? color : '#D1D5DB',
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
    >
      <View
        style={{
          width: 13,
          height: 13,
          borderRadius: 999,
          backgroundColor: '#fff',
          alignSelf: on ? 'flex-end' : 'flex-start',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </View>
  );
}
