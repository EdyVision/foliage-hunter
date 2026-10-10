import { enrichSpeciesTraits } from '@/application/enrichSpeciesTraits';
import type { GuideTurn, LeafPhoto } from '@/domain/guide';
import type { GuideClient } from '@/ports/GuideClient';
import type { PaletteReader } from '@/ports/PaletteReader';
import type { SpeakOptions, Speech } from '@/ports/Speech';

/** "scarlet, gold, and rust" — readable for TTS. */
export function joinNaturalList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

/**
 * Identify a leaf photo: ask the guide model and read the on-device palette in
 * parallel, append the color sentence, join curated species traits, then speak.
 * `speakOptions.saveKey` lets the speech adapter persist the clips for replay.
 */
export async function identifyLeaf(
  guide: GuideClient,
  speech: Speech,
  photo: LeafPhoto,
  options?: {
    speak?: boolean;
    prompt?: string;
    palette?: PaletteReader;
    speakOptions?: SpeakOptions;
  },
): Promise<GuideTurn> {
  const [turn, colors] = await Promise.all([
    guide.identifyPhoto(photo, options?.prompt),
    options?.palette ? options.palette.colorsFromPhoto(photo, 4) : Promise.resolve([]),
  ]);

  const colorNames = colors.map((c) => c.name);
  const listed = joinNaturalList(colorNames);
  const colorBit = listed ? ` Leaf colors include ${listed}.` : '';

  const withColors: GuideTurn = {
    ...turn,
    colors,
    reply: `${turn.reply}${colorBit}`.trim(),
  };

  const { turn: enriched, spoken } = enrichSpeciesTraits(withColors);

  if (options?.speak !== false) {
    await speech.speak(spoken, undefined, options?.speakOptions);
  }

  return enriched;
}
