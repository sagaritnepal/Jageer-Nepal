// lib/components/LocationMapPicker.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapSurface, type MapSurfaceHandle, type Coords } from './MapSurface';

export type { Coords } from './MapSurface';
export type LocationMapPickerHandle = { recenterTo: (coords: Coords) => void };

/** Drag-the-map location picker: a fixed pin sits in the center of the
 * view and the map itself is what moves, so whatever the pin's tip lands
 * on is the selected point (the same interaction Google Maps/Uber use for
 * pin-drop) - instead of a marker placed on the map that has to be
 * dragged. Reports the new center on every pan/zoom via onCenterChange. */
export const LocationMapPicker = forwardRef<LocationMapPickerHandle, {
  initialCoords: Coords;
  onCenterChange: (coords: Coords) => void;
  height?: number;
}>(function LocationMapPicker({ initialCoords, onCenterChange, height = 220 }, ref) {
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
        <Ionicons name="location-sharp" size={38} color="#DC2626" style={{ marginBottom: 19 }} />
      </View>
    </View>
  );
});
