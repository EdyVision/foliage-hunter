import type { LeafPhoto, PhotoColor } from '@/domain/guide';

export interface PaletteReader {
  colorsFromPhoto(photo: LeafPhoto, limit?: number): Promise<PhotoColor[]>;
}
