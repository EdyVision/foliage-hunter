// SDK 57: the root export is the new class-based API; saveToLibraryAsync lives on legacy.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

import type { PhotoShare } from '@/ports/PhotoShare';

async function ensureAddPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await MediaLibrary.requestPermissionsAsync(true);
  return asked.granted;
}

/** System share sheet + photo-library save via Expo modules (works in Expo Go). */
export function createExpoPhotoShare(): PhotoShare {
  return {
    async share(uri: string): Promise<void> {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share this find',
        UTI: 'public.jpeg',
      });
    },

    async saveToLibrary(uri: string): Promise<void> {
      if (!(await ensureAddPermission())) {
        throw new Error('Photo library access is required to save this find.');
      }
      await MediaLibrary.saveToLibraryAsync(uri);
    },
  };
}
