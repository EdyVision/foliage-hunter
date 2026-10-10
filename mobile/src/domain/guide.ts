import type { SpeciesTraits } from '@/domain/speciesTraits';

export interface VoiceRecording {
  uri: string;
  name: string;
  mediaType: string;
}

export interface LeafPhoto {
  uri: string;
  name: string;
  mediaType: string;
}

export interface PhotoColor {
  hex: string;
  name: string;
  share: number;
}

export interface GuideTurn {
  transcript: string;
  reply: string;
  leafGuess?: string;
  colors?: PhotoColor[];
  /** Curated forage note after ID (catalog join, not VLM). */
  traits?: SpeciesTraits;
}

/** @deprecated use GuideTurn */
export type VoiceTurnResult = GuideTurn;
