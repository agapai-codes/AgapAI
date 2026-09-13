/**
 * Coordinate utilities for the AgapAI dispatch system.
 * All coordinates follow MapLibre convention: [longitude, latitude].
 *
 * Philippines bounds:
 *   Latitude:  4.0°N – 21.5°N
 *   Longitude: 116.0°E – 127.0°E
 */

export interface GeoCoordinates {
  lng: number;
  lat: number;
  accuracy: number;
}

// ── Sanitization ─────────────────────────────────────────────────────────────

/** Philippines bounding box */
const PH_BOUNDS = { latMin: 4, latMax: 22, lngMin: 116, lngMax: 128 };

/**
 * Guard against [lat, lng] inversion.
 * If coords[0] looks like latitude (< 25) and coords[1] looks like longitude (> 100),
 * auto-invert to [lng, lat].
 */
export function sanitizeCoords(coords: [number, number]): [number, number] {
  const [a, b] = coords;
  // If a is in lat range and b is in lng range, they're inverted
  if (a >= PH_BOUNDS.latMin && a <= PH_BOUNDS.latMax && b >= PH_BOUNDS.lngMin && b <= PH_BOUNDS.lngMax) {
    return [b, a]; // invert to [lng, lat]
  }
  return [a, b];
}

/**
 * Validate that coordinates fall within the Philippines bounding box.
 * Returns true if valid, false if suspicious.
 */
export function isValidPHCoords(lng: number, lat: number): boolean {
  return lng >= PH_BOUNDS.lngMin && lng <= PH_BOUNDS.lngMax &&
         lat >= PH_BOUNDS.latMin && lat <= PH_BOUNDS.latMax;
}

// ── Format for MapLibre ──────────────────────────────────────────────────────

/** Explicitly format as [longitude, latitude] for MapLibre */
export function formatMapLibreCoords(lat: number, lng: number): [number, number] {
  return [Number(lng), Number(lat)];
}

// ── Display ──────────────────────────────────────────────────────────────────

/** Format for human-readable display: "lat, lng" */
export function formatDisplayCoords(coords: [number, number]): string {
  const [lng, lat] = coords;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ── Iligan City Landmark Geocoding ──────────────────────────────────────────

interface LandmarkEntry {
  patterns: RegExp[];
  coords: [number, number]; // [lng, lat]
  name: string;
}

const ILIGAN_LANDMARKS: LandmarkEntry[] = [
  { patterns: [/tubod/i], coords: [124.2580, 8.2190], name: 'Tubod, Iligan City' },
  { patterns: [/pala[\s-]?o/i], coords: [124.2545, 8.2250], name: 'Pala-o, Iligan City' },
  { patterns: [/tibanga/i], coords: [124.2481, 8.2375], name: 'Tibanga, Iligan City' },
  { patterns: [/msu[\s-]?iit|engineering\s*(building|complex)/i], coords: [124.2442, 8.2418], name: 'MSU-IIT Engineering Complex' },
  { patterns: [/hinaplanon/i], coords: [124.2290, 8.2480], name: 'Hinaplanon, Iligan City' },
  { patterns: [/poblacion/i], coords: [124.2405, 8.2285], name: 'Poblacion, Iligan City' },
  { patterns: [/buru[\s-]?un/i], coords: [124.1850, 8.1960], name: 'Buru-un, Iligan City' },
  { patterns: [/sabayle/i], coords: [124.2410, 8.2365], name: 'Sabayle St, Iligan City' },
  { patterns: [/abuno/i], coords: [124.2350, 8.2450], name: 'Abuno, Iligan City' },
  { patterns: [/rodel/i], coords: [124.2520, 8.2300], name: 'Rodel, Iligan City' },
  { patterns: [/villa\s*verde/i], coords: [124.2460, 8.2340], name: 'Villa Verde, Iligan City' },
  { patterns: [/santa\s*filomena/i], coords: [124.2420, 8.2310], name: 'Santa Filomena, Iligan City' },
  { patterns: [/ubaldo/i], coords: [124.2500, 8.2230], name: 'Ubaldo D. Laya, Iligan City' },
  { patterns: [/bayuga/i], coords: [124.2380, 8.2390], name: 'Bayuga, Iligan City' },
  { patterns: [/dona\s*maria/i], coords: [124.2560, 8.2210], name: 'Dona Maria Subdivision, Tubod' },
  { patterns: [/antipolo/i], coords: [124.2470, 8.2330], name: 'Antipolo, Iligan City' },
  { patterns: [/saray/i], coords: [124.2430, 8.2350], name: 'Saray, Iligan City' },
  { patterns: [/lumbia/i], coords: [124.2390, 8.2420], name: 'Lumbia, Iligan City' },
];

/**
 * Extract landmark coordinates from transcript text.
 * Returns [lng, lat] if a known landmark is found, otherwise null.
 */
export function extractLandmarkCoords(transcript: string): [number, number] | null {
  if (!transcript) return null;
  for (const entry of ILIGAN_LANDMARKS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(transcript)) {
        return entry.coords;
      }
    }
  }
  return null;
}

// ── Smart Coordinate Resolution ──────────────────────────────────────────────

/**
 * Resolve the best available coordinates for an incident.
 * Priority: real GPS > transcript landmark > random PH fallback.
 */
export function resolveIncidentCoords(
  gpsCoords: { lng: number; lat: number } | null,
  transcript: string | null,
): { lng: number; lat: number } {
  // 1. Use real GPS if available and valid
  if (gpsCoords && isValidPHCoords(gpsCoords.lng, gpsCoords.lat)) {
    return gpsCoords;
  }

  // 2. Try landmark extraction from transcript
  if (transcript) {
    const landmark = extractLandmarkCoords(transcript);
    if (landmark) {
      return { lng: landmark[0], lat: landmark[1] };
    }
  }

  // 3. Random PH fallback (never a single fixed point)
  const fallback = getRandomPHCoords();
  return { lng: fallback.lng, lat: fallback.lat };
}

// Re-export getRandomPHCoords from geolocation.ts
import { getRandomPHCoords } from './geolocation';
