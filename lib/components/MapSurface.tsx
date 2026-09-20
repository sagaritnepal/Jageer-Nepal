// lib/components/MapSurface.tsx
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { buildCrosshairMapHtml } from '../utils/leafletMapHtml';

export type Coords = { latitude: number; longitude: number };

export type MapSurfaceHandle = { recenterTo: (coords: Coords) => void };

/** Native (iOS/Android) half of the Leaflet map surface - loads the map
 * HTML once via WebView and drives it afterwards through injectJavaScript
 * rather than re-rendering, so panning/zoom the person already did isn't
 * reset by every coords update. MapSurface.web.tsx is the web counterpart
 * (WebView has no web implementation); LocationMapPicker composes
 * whichever one Metro resolves with the fixed crosshair overlay. */
export const MapSurface = forwardRef<MapSurfaceHandle, { initialCoords: Coords; onCenterChange: (coords: Coords) => void }>(
  function MapSurface({ initialCoords, onCenterChange }, ref) {
    const webviewRef = useRef<WebView>(null);
    // Built once from whatever coords the picker opened with - later moves
    // go through __recenter, not a fresh HTML string (which would reload
    // the whole map and lose the person's zoom level).
    const html = useMemo(() => buildCrosshairMapHtml(initialCoords.latitude, initialCoords.longitude), []); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      recenterTo(coords) {
        webviewRef.current?.injectJavaScript(`window.__recenter(${coords.latitude}, ${coords.longitude}); true;`);
      },
    }));

    function handleMessage(event: WebViewMessageEvent) {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'center') onCenterChange({ latitude: data.lat, longitude: data.lng });
      } catch {
        // Ignore malformed bridge messages.
      }
    }

    return (
      <WebView
        ref={webviewRef}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    );
  }
);
