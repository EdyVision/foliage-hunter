import type { FindLocation, FindRecord } from '@/domain/find';
import type { GuideTurn } from '@/domain/guide';
import type { FindHistory } from '@/ports/FindHistory';

/** Mint a find id up front so speech clips can be saved under it before the record exists. */
export function newFindId(): string {
  return `find-${Date.now()}`;
}

export interface RecordFindOptions {
  id?: string;
  /** Where the leaf was found; omitted from the record when null. */
  location?: FindLocation | null;
}

/** Persist an identified turn as a trail find. */
export async function recordFind(
  history: FindHistory,
  photoUri: string,
  turn: GuideTurn,
  options: RecordFindOptions = {},
): Promise<FindRecord> {
  return history.add({
    id: options.id,
    photoUri,
    leafGuess: turn.leafGuess,
    reply: turn.reply,
    colors: turn.colors ?? [],
    location: options.location ?? undefined,
  });
}
