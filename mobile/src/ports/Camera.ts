import type { LeafPhoto } from '@/domain/guide';

export interface Camera {
  captureLeaf(): Promise<LeafPhoto | null>;
  pickLeaf(): Promise<LeafPhoto | null>;
}
