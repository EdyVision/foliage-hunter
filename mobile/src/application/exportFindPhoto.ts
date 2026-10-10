import { Alert, Platform } from 'react-native';

import type { PhotoShare } from '@/ports/PhotoShare';

/**
 * Offer Share… and Save to Photos for a find's leaf image. Share opens the
 * system sheet; Save copies into the camera roll (images otherwise stay in
 * the app cache and never appear in Photos).
 */
export function exportFindPhoto(share: PhotoShare, photoUri: string): void {
  Alert.alert('Share this find', 'Get the leaf photo out of the app.', [
    {
      text: 'Share…',
      onPress: () => {
        void share.share(photoUri).catch((cause) => {
          Alert.alert(
            'Could not share',
            cause instanceof Error ? cause.message : 'Sharing failed.',
          );
        });
      },
    },
    {
      text: Platform.OS === 'ios' ? 'Save to Photos' : 'Save to Gallery',
      onPress: () => {
        void share.saveToLibrary(photoUri).catch((cause) => {
          Alert.alert(
            'Could not save',
            cause instanceof Error ? cause.message : 'Save failed.',
          );
        });
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
