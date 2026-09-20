// lib/utils/mapEmbedUrl.ts

// Roughly an 800m-wide box around the pin - close enough to confirm "is this
// the right spot" without the request needing a full pan/zoom map.
const DEGREE_SPAN = 0.008;

/** OpenStreetMap's own free, keyless embed page - shared by the native
 * (WebView) and web (iframe) MapPreview implementations so the bbox/marker
 * math lives in one place. */
export function osmEmbedUrl(coords: { latitude: number; longitude: number }): string {
  const { latitude, longitude } = coords;
  const bbox = [
    longitude - DEGREE_SPAN,
    latitude - DEGREE_SPAN,
    longitude + DEGREE_SPAN,
    latitude + DEGREE_SPAN,
  ].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
