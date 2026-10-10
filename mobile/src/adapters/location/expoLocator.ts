import * as Location from 'expo-location';

import type { FindLocation } from '@/domain/find';
import type { Locator } from '@/ports/Locator';

export interface ExpoLocatorOptions {
  /** Upper bound on waiting for a fresh fix before falling back to the last known one. */
  fixTimeoutMs?: number;
  /** Upper bound on the reverse-geocode lookup; coordinates are kept either way. */
  geocodeTimeoutMs?: number;
}

const DEFAULT_FIX_TIMEOUT_MS = 6000;
const DEFAULT_GEOCODE_TIMEOUT_MS = 4000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted;
}

async function currentPosition(fixTimeoutMs: number): Promise<Location.LocationObject | null> {
  const fresh = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    fixTimeoutMs,
  );
  if (fresh) return fresh;

  return withTimeout(Location.getLastKnownPositionAsync(), 1000);
}

async function placeFor(
  latitude: number,
  longitude: number,
  geocodeTimeoutMs: number,
): Promise<Pick<FindLocation, 'city' | 'region'>> {
  const results = await withTimeout(
    Location.reverseGeocodeAsync({ latitude, longitude }),
    geocodeTimeoutMs,
  );
  const first = results?.[0];
  if (!first) return {};

  return {
    city: first.city ?? first.subregion ?? undefined,
    region: first.region ?? undefined,
  };
}

/**
 * Phone GPS via expo-location, reverse geocoded with the platform geocoder
 * (Apple on iOS, Android's on Android). No third-party key, nothing leaves the
 * device except the geocode lookup to the platform vendor.
 */
export function createExpoLocator(options: ExpoLocatorOptions = {}): Locator {
  const fixTimeoutMs = options.fixTimeoutMs ?? DEFAULT_FIX_TIMEOUT_MS;
  const geocodeTimeoutMs = options.geocodeTimeoutMs ?? DEFAULT_GEOCODE_TIMEOUT_MS;

  return {
    async locate(): Promise<FindLocation | null> {
      try {
        if (!(await ensurePermission())) return null;

        const position = await currentPosition(fixTimeoutMs);
        if (!position) return null;

        const { latitude, longitude } = position.coords;
        const place = await placeFor(latitude, longitude, geocodeTimeoutMs);

        return { latitude, longitude, ...place };
      } catch (cause) {
        console.warn('[foliage] location unavailable:', cause);
        return null;
      }
    },
  };
}
