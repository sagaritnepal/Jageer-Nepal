// lib/components/LocationMapPicker.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapSurface, type MapSurfaceHandle, type Coords } from './MapSurface';

export type { Coords } from './MapSurface';
export type LocationMapPickerHandle = { recenterTo: (coords: Coords) => void };

// Half the pin icon's size (see PIN_SIZE below) - both the pin and the
// popup are anchored off this same offset so the popup's tail always
// meets the pin's tip regardless of how tall the address text wraps.
const PIN_SIZE = 38;
const PIN_TIP_OFFSET = PIN_SIZE / 2;

/** Drag-the-map location picker: a fixed pin sits in the center of the
 * view and the map itself is what moves, so whatever the pin's tip lands
 * on is the selected point (the same interaction Google Maps/Uber use for
 * pin-drop) - instead of a marker placed on the map that has to be
 * dragged. Reports the new center on every pan/zoom via onCenterChange.
 * A small popup floats above the pin showing the address at that point,
 * since a line of text below the map made it easy to miss what the pin
 * actually landed on. */
export const LocationMapPicker = forwardRef<LocationMapPickerHandle, {
  initialCoords: Coords;
  onCenterChange: (coords: Coords) => void;
  height?: number;
  address?: string;
  addressLoading?: boolean;
}>(function LocationMapPicker({ initialCoords, onCenterChange, height = 220, address, addressLoading }, ref) {
  const surfaceRef = useRef<MapSurfaceHandle>(null);

  useImperativeHandle(ref, () => ({
    recenterTo(coords) {
      surfaceRef.current?.recenterTo(coords);
    },
  }));

  return (
    <View style={{ height, borderRadius: 8, overflow: 'hidden' }} className="border border-gray-200">
      <MapSurface ref={surfaceRef} initialCoords={initialCoords} onCenterChange={onCenterChange} />

      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="location-sharp" size={PIN_SIZE} color="#DC2626" style={{ marginBottom: PIN_TIP_OFFSET }} />
      </View>

      {(addressLoading || !!address) && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 8, right: 8, bottom: '50%', marginBottom: PIN_TIP_OFFSET, alignItems: 'center' }}
        >
          <View
            className="rounded-lg bg-white px-2.5 py-1.5"
            style={{
              maxWidth: '100%',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
          >
            <Text className="text-center text-xs font-medium text-gray-800" numberOfLines={2}>
              {addressLoading ? 'Locating…' : address}
            </Text>
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 6,
              borderRightWidth: 6,
              borderTopWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: 'white',
            }}
          />
        </View>
      )}
    </View>
  );
});
