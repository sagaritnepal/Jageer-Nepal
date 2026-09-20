// lib/components/MapSurface.web.tsx
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { buildCrosshairMapHtml } from '../utils/leafletMapHtml';

export type Coords = { latitude: number; longitude: number };

export type MapSurfaceHandle = { recenterTo: (coords: Coords) => void };

/** Web counterpart of MapSurface - same Leaflet HTML page, loaded into a
 * plain <iframe srcDoc> instead of react-native-webview (which has no web
 * implementation), driven via postMessage instead of injectJavaScript. */
export const MapSurface = forwardRef<MapSurfaceHandle, { initialCoords: Coords; onCenterChange: (coords: Coords) => void }>(
  function MapSurface({ initialCoords, onCenterChange }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const html = useMemo(() => buildCrosshairMapHtml(initialCoords.latitude, initialCoords.longitude), []); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      recenterTo(coords) {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: 'recenter', lat: coords.latitude, lng: coords.longitude }),
          '*'
        );
      },
    }));

    useEffect(() => {
      function handleMessage(event: MessageEvent) {
        if (event.source !== iframeRef.current?.contentWindow) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'center') onCenterChange({ latitude: data.lat, longitude: data.lng });
        } catch {
          // Ignore malformed bridge messages.
        }
      }
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onCenterChange]);

    return <iframe ref={iframeRef} srcDoc={html} title="Location map" style={{ width: '100%', height: '100%', border: 0 }} />;
  }
);
