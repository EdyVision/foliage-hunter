import type { FindLocation } from '@/domain/find';

export interface Locator {
  /**
   * Best-effort position for the current find. Resolves to null when permission
   * is denied, no fix arrives within the adapter's time budget, or the platform
   * has no location service. Never throws; a find must save without a place.
   */
  locate(): Promise<FindLocation | null>;
}
