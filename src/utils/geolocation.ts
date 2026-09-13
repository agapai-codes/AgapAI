'use client';

export interface GeoCoordinates {
  lng: number;
  lat: number;
  accuracy: number;
}

const PHILIPPINES_CENTERS = [
  { lng: 120.9842, lat: 14.5995 }, // Manila
  { lng: 123.8854, lat: 10.3157 }, // Cebu
  { lng: 125.6128, lat: 7.0731 },  // Davao
  { lng: 124.2452, lat: 8.2280 },  // Iligan City
  { lng: 121.0500, lat: 14.5547 }, // BGC
  { lng: 124.6128, lat: 8.4544 },  // Cagayan de Oro
  { lng: 122.5568, lat: 10.7202 }, // Bacolod
  { lng: 119.9997, lat: 10.3000 }, // Puerto Princesa
];

/** Generates fallback positions distributed across PH cities with micro-jitter */
export function getRandomPHCoords(): GeoCoordinates {
  const base = PHILIPPINES_CENTERS[Math.floor(Math.random() * PHILIPPINES_CENTERS.length)];
  const jitterLng = base.lng + (Math.random() - 0.5) * 0.02;
  const jitterLat = base.lat + (Math.random() - 0.5) * 0.02;
  return { lng: jitterLng, lat: jitterLat, accuracy: 50 };
}

/** One-shot async GPS acquisition — resolves real hardware coords or random PH fallback */
export async function getRealCoordinates(): Promise<GeoCoordinates> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return resolve(getRandomPHCoords());
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.warn('Geolocation failed or permission denied:', error.message);
        resolve(getRandomPHCoords());
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
