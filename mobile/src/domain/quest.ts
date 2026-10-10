export interface ColorQuest {
  id: string;
  name: string;
  hex: string;
  verb: string;
  why: string;
}

const QUESTS: ColorQuest[] = [
  {
    id: 'scarlet',
    name: 'scarlet',
    hex: '#9B2226',
    verb: 'Match scarlet outdoors',
    why: 'Feeds flatten autumn. Real scarlet only happens on a walk.',
  },
  {
    id: 'rust',
    name: 'rust',
    hex: '#C2410C',
    verb: 'Find rust on a leaf',
    why: 'Rust is not a filter. It is a tree letting go.',
  },
  {
    id: 'ember',
    name: 'ember',
    hex: '#E85D04',
    verb: 'Chase ember orange',
    why: 'Your screen cannot hold this heat. Go get it.',
  },
  {
    id: 'amber',
    name: 'amber',
    hex: '#F4A261',
    verb: 'Hunt amber light',
    why: 'Amber is a reason to leave the couch.',
  },
  {
    id: 'gold',
    name: 'gold',
    hex: '#FFBA08',
    verb: 'Catch gold before dusk',
    why: 'Gold leaves do not wait for your notifications.',
  },
  {
    id: 'forest',
    name: 'forest',
    hex: '#2D6A4F',
    verb: 'Still green counts',
    why: 'Not every leaf has turned. Find the holdout.',
  },
];

/** Stable daily pick from local calendar day. */
export function questForDate(date: Date = new Date()): ColorQuest {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return QUESTS[hash % QUESTS.length]!;
}
