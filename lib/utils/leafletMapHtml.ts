// lib/utils/leafletMapHtml.ts

// Standalone HTML page (Leaflet + OSM tiles, both free/keyless) loaded into
// a WebView (native) or an iframe (web) by LocationMapPicker. Deliberately
// has no on-map marker - the app draws a fixed crosshair over the map
// container instead, Uber/Google-Maps-pin-drop style, and reads off
// whatever ends up under it via the 'moveend' postMessage below.
export function buildCrosshairMapHtml(initialLatitude: number, initialLongitude: number, initialZoom = 16): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E5E7EB; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${initialLatitude}, ${initialLongitude}], ${initialZoom});

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function post(payload) {
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(msg);
    } else if (window.parent) {
      window.parent.postMessage(msg, '*');
    }
  }

  // Called directly (native, via injectJavaScript) or via the postMessage
  // bridge below (web) - either way this is the one place that moves the map.
  window.__recenter = function (lat, lng, zoom) {
    map.setView([lat, lng], zoom || map.getZoom());
  };

  window.addEventListener('message', function (event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'recenter') window.__recenter(data.lat, data.lng, data.zoom);
    } catch (e) {}
  });

  map.on('moveend', function () {
    var c = map.getCenter();
    post({ type: 'center', lat: c.lat, lng: c.lng });
  });
</script>
</body>
</html>`;
}
