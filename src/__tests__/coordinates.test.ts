import { describe, it, expect } from 'vitest';
import {
  sanitizeCoords,
  isValidPHCoords,
  formatMapLibreCoords,
  formatDisplayCoords,
  extractLandmarkCoords,
  resolveIncidentCoords,
} from '../utils/coordinates';

describe('sanitizeCoords', () => {
  it('returns [lng, lat] when correctly ordered', () => {
    const result = sanitizeCoords([124.24, 8.23]);
    expect(result).toEqual([124.24, 8.23]);
  });

  it('inverts [lat, lng] to [lng, lat] when coords look inverted', () => {
    // lat=8.23 (in PH range 4-22), lng=124.24 (in PH range 116-128) => inverted
    const result = sanitizeCoords([8.23, 124.24]);
    expect(result).toEqual([124.24, 8.23]);
  });

  it('does not invert coords that are already correct', () => {
    // Both in lng range => not inverted
    const result = sanitizeCoords([121.77, 14.60]);
    expect(result).toEqual([121.77, 14.60]);
  });
});

describe('isValidPHCoords', () => {
  it('returns true for valid Iligan City coords', () => {
    expect(isValidPHCoords(124.2452, 8.2280)).toBe(true);
  });

  it('returns true for Manila coords', () => {
    expect(isValidPHCoords(120.9842, 14.5995)).toBe(true);
  });

  it('returns false for coords outside Philippines', () => {
    expect(isValidPHCoords(-73.9857, 40.7484)).toBe(false); // New York
  });

  it('returns false for zero coords', () => {
    expect(isValidPHCoords(0, 0)).toBe(false);
  });
});

describe('formatMapLibreCoords', () => {
  it('returns [lng, lat] from lat, lng inputs', () => {
    const result = formatMapLibreCoords(8.23, 124.24);
    expect(result).toEqual([124.24, 8.23]);
  });

  it('handles string inputs by converting to numbers', () => {
    const result = formatMapLibreCoords('8.23' as any, '124.24' as any);
    expect(result).toEqual([124.24, 8.23]);
  });
});

describe('formatDisplayCoords', () => {
  it('formats as "lat, lng"', () => {
    const result = formatDisplayCoords([124.2452, 8.2280]);
    expect(result).toBe('8.22800, 124.24520');
  });
});

describe('extractLandmarkCoords', () => {
  it('extracts Tubod coordinates from transcript', () => {
    const result = extractLandmarkCoords('Bleeding at Dona Maria subdivision Tubod');
    expect(result).toEqual([124.2580, 8.2190]);
  });

  it('extracts MSU-IIT coordinates', () => {
    const result = extractLandmarkCoords('Emergency at the engineering building MSU-IIT');
    expect(result).toEqual([124.2442, 8.2418]);
  });

  it('extracts Pala-o coordinates', () => {
    const result = extractLandmarkCoords('Fire near Pala-o market');
    expect(result).toEqual([124.2545, 8.2250]);
  });

  it('returns null for unknown landmarks', () => {
    const result = extractLandmarkCoords('Emergency at an unknown location');
    expect(result).toBeNull();
  });

  it('returns null for empty transcript', () => {
    expect(extractLandmarkCoords('')).toBeNull();
    expect(extractLandmarkCoords(null as any)).toBeNull();
  });
});

describe('resolveIncidentCoords', () => {
  it('returns GPS coords when valid', () => {
    const result = resolveIncidentCoords({ lng: 124.24, lat: 8.23 }, null);
    expect(result).toEqual({ lng: 124.24, lat: 8.23 });
  });

  it('uses landmark when GPS is null', () => {
    const result = resolveIncidentCoords(null, 'Emergency at Tubod');
    expect(result.lng).toBeCloseTo(124.258, 2);
    expect(result.lat).toBeCloseTo(8.219, 2);
  });

  it('falls back to random PH coords when both GPS and landmark fail', () => {
    const result = resolveIncidentCoords(null, 'Unknown location XYZ');
    expect(result.lng).toBeGreaterThan(116);
    expect(result.lng).toBeLessThan(128);
    expect(result.lat).toBeGreaterThan(4);
    expect(result.lat).toBeLessThan(22);
  });
});
