import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { LeafPhoto } from '@/domain/guide';
import type { Camera } from '@/ports/Camera';

/** Longest edge sent to the guide. Plenty for species ID, small enough for cellular. */
const MAX_EDGE = 1280;

/**
 * Real iPhones shoot HEIC; the guide server (PIL) and the palette reader both
 * need JPEG. Re-encode every asset so what we label `image/jpeg` really is.
 */
async function toJpegPhoto(asset: ImagePicker.ImagePickerAsset): Promise<LeafPhoto> {
  const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
  const resize =
    asset.width && asset.height && Math.max(asset.width, asset.height) > MAX_EDGE
      ? [landscape ? { resize: { width: MAX_EDGE } } : { resize: { height: MAX_EDGE } }]
      : [];

  const jpeg = await ImageManipulator.manipulateAsync(asset.uri, resize, {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: jpeg.uri,
    name: 'leaf.jpg',
    mediaType: 'image/jpeg',
  };
}

export function createExpoCamera(): Camera {
  return {
    async captureLeaf(): Promise<LeafPhoto | null> {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Camera access is required to snap a leaf.');
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        exif: false,
      });
      if (result.canceled || !result.assets[0]) return null;
      return toJpegPhoto(result.assets[0]);
    },

    async pickLeaf(): Promise<LeafPhoto | null> {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is required to choose a leaf.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        exif: false,
      });
      if (result.canceled || !result.assets[0]) return null;
      return toJpegPhoto(result.assets[0]);
    },
  };
}
