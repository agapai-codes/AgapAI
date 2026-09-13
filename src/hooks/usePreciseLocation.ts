'use client';

import { useState, useCallback } from 'react';

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

const PHILIPPINES_CENTER: [number, number] = [121.7740, 12.8797];

export function usePreciseLocation(): UsePreciseLocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback((): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setStatus('error');
        setError('Geolocation not supported by browser');
        resolve(null);
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
          console.warn('High accuracy geolocation failed, using coarse fallback:', err.message);
          const fallback: GeoPosition = {
            coords: PHILIPPINES_CENTER,
            accuracy: 0,
          };
          setPosition(fallback);
          setStatus('error');
          setError(err.message);
          resolve(fallback);
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
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(PHILIPPINES_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      () => {
        resolve(PHILIPPINES_CENTER);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
