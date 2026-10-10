import type { GuideTurn } from '@/domain/guide';
import { lookupSpeciesTraits } from '@/domain/speciesTraits';

/** Spoken line: identification reply, then curated details when in catalog. */
export function spokenWithTraits(turn: GuideTurn): string {
  const traits = turn.traits ?? lookupSpeciesTraits(turn.leafGuess);
  if (!traits) return turn.reply;
  return `${turn.reply} ${traits.note}`.replace(/\s+/g, ' ').trim();
}

/** Attach curated forage traits and build the spoken line. */
export function enrichSpeciesTraits(turn: GuideTurn): {
  turn: GuideTurn;
  spoken: string;
} {
  const traits = lookupSpeciesTraits(turn.leafGuess);
  if (!traits) {
    return { turn, spoken: turn.reply };
  }

  const enriched: GuideTurn = { ...turn, traits };
  return {
    turn: enriched,
    spoken: spokenWithTraits(enriched),
  };
}
