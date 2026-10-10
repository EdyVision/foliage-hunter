export interface FallTheme {
  dark: true;
  background: string;
  surface: string;
  modalSurface: string;
  elevated: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentBright: string;
  accentDim: string;
  gold: string;
  rust: string;
  crimson: string;
  critical: string;
  glass: string;
  glassBorder: string;
  glowScarlet: string;
  glowGold: string;
  glowForest: string;
}

/** Autumn accents on a charcoal-forest canvas, with glass overlays. */
export const fallTheme: FallTheme = {
  dark: true,
  background: '#101412',
  surface: '#1A201CEE',
  modalSurface: '#151A17D9',
  elevated: '#262C28CC',
  text: '#F4F1EA',
  muted: '#B8A99A',
  border: '#3A423C',
  accent: '#E85D04',
  accentBright: '#FFBA08',
  accentDim: '#7C2D12',
  gold: '#E0B07A',
  rust: '#C2410C',
  crimson: '#9B2226',
  critical: '#FF6B6B',
  glass: '#1C2420B8',
  glassBorder: '#F4F1EA22',
  glowScarlet: '#9B222655',
  glowGold: '#FFBA0833',
  glowForest: '#2D6A4F44',
};

export function useFallTheme(): FallTheme {
  return fallTheme;
}
