import type { PhotoColor } from '@/domain/guide';

/** Where a leaf was found. Coordinates from the phone; place names are best effort. */
export interface FindLocation {
  latitude: number;
  longitude: number;
  /** Town or city, when reverse geocoding succeeded. */
  city?: string;
  /** State or province, when reverse geocoding succeeded. */
  region?: string;
}

export interface FindRecord {
  id: string;
  photoUri: string;
  leafGuess?: string;
  reply: string;
  colors: PhotoColor[];
  createdAt: string;
  /** Saved guide clips (one per sentence) so a past find replays offline. */
  audioUris?: string[];
  /** Absent when location permission was denied or no fix arrived in time. */
  location?: FindLocation;
}

/** "City Name, State" when both parts are known; otherwise whichever part is, or rounded coordinates. */
export function formatPlace(location: FindLocation | undefined): string | undefined {
  if (!location) return undefined;

  const parts = [location.city, location.region].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(', ');

  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}
