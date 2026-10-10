/**
 * Curated post-ID enrichment for Colorado priority species.
 * Not foraging advice: lookup only after the guide names a leaf.
 */

export type ForageKind = 'edible' | 'caution' | 'toxic' | 'not_food' | 'unknown';

export interface SpeciesTraits {
  /** Canonical common name (matches catalog). */
  common: string;
  aliases: string[];
  forage: ForageKind;
  /** Short line for UI + TTS. */
  note: string;
}

export const FORAGE_DISCLAIMER =
  'Not foraging advice. Never eat wild plants unless an expert confirms them.';

const TRAITS: SpeciesTraits[] = [
  {
    common: 'quaking aspen',
    aliases: ['aspen', 'populus tremuloides'],
    forage: 'not_food',
    note: 'Famous for fluttering leaves and Colorado gold in fall. Bark and buds feed wildlife, not a human snack.',
  },
  {
    common: 'narrowleaf cottonwood',
    aliases: ['cottonwood', 'populus angustifolia'],
    forage: 'not_food',
    note: 'Famous as a tall river-corridor shade tree. Not a food plant.',
  },
  {
    common: 'Gambel oak',
    aliases: ['gambel oak', 'scrub oak', 'quercus gambelii'],
    forage: 'caution',
    note: 'Famous for Front Range scrub oak thickets. Acorns need heavy processing before any use.',
  },
  {
    common: 'boxelder',
    aliases: ['box elder', 'acer negundo'],
    forage: 'not_food',
    note: 'A maple relative common in yards and washes. Grown for shade, not fruit.',
  },
  {
    common: 'Rocky Mountain maple',
    aliases: ['rocky mountain maple', 'acer glabrum'],
    forage: 'not_food',
    note: 'A mountain understory maple with fine fall color. For looking, not tasting.',
  },
  {
    common: 'chokecherry',
    aliases: ['prunus virginiana'],
    forage: 'caution',
    note: 'Famous for dark summer fruit used in jellies when cooked. Pits, leaves, and wilted foliage are toxic.',
  },
  {
    common: 'serviceberry',
    aliases: ['juneberry', 'saskatoon', 'amelanchier', 'amelanchier alnifolia'],
    forage: 'edible',
    note: 'Famous for sweet June berries. Ripe fruit is the treat; unripe fruit and seeds are not.',
  },
  {
    common: 'peachleaf willow',
    aliases: ['willow', 'salix amygdaloides'],
    forage: 'not_food',
    note: 'A classic streamside willow. Not eaten as food.',
  },
  {
    common: 'green ash',
    aliases: ['ash', 'fraxinus pennsylvanica'],
    forage: 'not_food',
    note: 'A common street and park tree. Not a food plant.',
  },
  {
    common: 'Siberian elm',
    aliases: ['elm', 'ulmus pumila'],
    forage: 'not_food',
    note: 'A tough urban elm planted across the plains. Not eaten as food.',
  },
  {
    common: 'silver maple',
    aliases: ['acer saccharinum'],
    forage: 'not_food',
    note: 'Known for fast growth and deeply cut leaves. Sap is not the sugar-maple syrup story.',
  },
  {
    common: 'sugar maple',
    aliases: ['acer saccharum'],
    forage: 'caution',
    note: 'Famous for tapped sap made into maple syrup. Leaves and raw parts are not snacks.',
  },
  {
    common: 'northern red oak',
    aliases: ['red oak', 'quercus rubra'],
    forage: 'caution',
    note: 'Famous for pointed-lobed leaves and strong fall red. Acorns are high-tannin and need processing.',
  },
  {
    common: 'American sweetgum',
    aliases: ['sweetgum', 'liquidambar', 'liquidambar styraciflua'],
    forage: 'not_food',
    note: 'Famous for star-shaped leaves and spiky gum balls. Not a food plant.',
  },
  {
    common: 'ginkgo',
    aliases: ['ginkgo biloba', 'maidenhair tree'],
    forage: 'caution',
    note: 'Famous as a living fossil with fan-shaped leaves. Seeds need careful prep; the fleshy coat is foul and irritating.',
  },
  {
    common: 'ponderosa pine',
    aliases: ['pinus ponderosa', 'yellow pine'],
    forage: 'caution',
    note: 'Famous for vanilla-scented bark and long needles in threes. Needles and seeds appear in traditional uses; know your pines before tasting.',
  },
  {
    common: 'Douglas-fir',
    aliases: ['douglas fir', 'pseudotsuga menziesii'],
    forage: 'caution',
    note: 'A Rockies timber classic with soft needles and mouse-tail cones. Tips are sometimes used as tea by people who know the tree.',
  },
  {
    common: 'blue spruce',
    aliases: ['colorado blue spruce', 'picea pungens', 'spruce'],
    forage: 'caution',
    note: "Colorado's state tree, famous for steely-blue needles. Tips show up in foraged teas; bark and wood are not food.",
  },
];

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupSpeciesTraits(leafGuess?: string): SpeciesTraits | undefined {
  if (!leafGuess?.trim()) return undefined;
  const key = normalizeKey(leafGuess);
  if (!key) return undefined;

  for (const row of TRAITS) {
    const names = [row.common, ...row.aliases].map(normalizeKey);
    if (names.some((n) => n === key || key.includes(n) || n.includes(key))) {
      return row;
    }
  }
  return undefined;
}

/** Soft trail tags (not alarm chrome). Prefer the Details section copy in UI. */
export function forageLabel(kind: ForageKind): string {
  switch (kind) {
    case 'edible':
      return 'Edible parts';
    case 'caution':
      return 'Worth knowing';
    case 'toxic':
      return 'Toxic parts';
    case 'not_food':
      return 'Not food';
    default:
      return 'Trail note';
  }
}
