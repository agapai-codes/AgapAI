'use client';

import { useState, useCallback } from 'react';
import { getRandomPHCoords, type GeoCoordinates } from '../utils/geolocation';

export interface GeoPosition {
  coords: [number, number]; // [longitude, latitude]
  accuracy: number;
}

export interface UsePreciseLocationReturn {
  position: GeoPosition | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  acquire: () => Promise<GeoPosition | null>;
}

export function usePreciseLocation(): UsePreciseLocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback((): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const fallback = getRandomPHCoords();
        const result: GeoPosition = { coords: [fallback.lng, fallback.lat], accuracy: fallback.accuracy };
        setPosition(result);
        setStatus('error');
        setError('Geolocation not supported by browser');
        resolve(result);
        return;
      }

      setStatus('loading');
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result: GeoPosition = {
            coords: [pos.coords.longitude, pos.coords.latitude],
            accuracy: pos.coords.accuracy,
          };
          setPosition(result);
          setStatus('ready');
          resolve(result);
        },
        (err) => {
          console.warn('Geolocation failed, using distributed fallback:', err.message);
          const fallback = getRandomPHCoords();
          const result: GeoPosition = { coords: [fallback.lng, fallback.lat], accuracy: fallback.accuracy };
          setPosition(result);
          setStatus('error');
          setError(err.message);
          resolve(result);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return { position, status, error, acquire };
}

/** One-shot async function — no React state, for use outside components */
export async function getAccuratePosition(): Promise<[number, number]> {
  const { getRealCoordinates } = await import('../utils/geolocation');
  const pos = await getRealCoordinates();
  return [pos.lng, pos.lat];
}
