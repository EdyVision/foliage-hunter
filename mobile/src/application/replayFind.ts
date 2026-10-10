import { spokenWithTraits } from '@/application/enrichSpeciesTraits';
import type { FindRecord } from '@/domain/find';
import { lookupSpeciesTraits } from '@/domain/speciesTraits';
import type { FindHistory } from '@/ports/FindHistory';
import type { Speech } from '@/ports/Speech';

/**
 * Speak a past find. Saved clips play offline; a find recorded before clips
 * existed is synthesized from its stored text and saved for next time.
 */
export async function replayFind(
  speech: Speech,
  history: FindHistory,
  find: FindRecord,
): Promise<void> {
  const spoken = spokenWithTraits({
    transcript: '(history)',
    reply: find.reply,
    leafGuess: find.leafGuess,
    colors: find.colors,
    traits: lookupSpeciesTraits(find.leafGuess),
  });

  speech.stop();
  await speech.speak(
    spoken,
    find.audioUris?.length ? { uris: find.audioUris } : undefined,
    {
      saveKey: find.id,
      onSaved: (uris) => {
        void history.update(find.id, { audioUris: uris });
      },
    },
  );
}

/** Remove a find and the clips saved for it. */
export async function deleteFind(
  speech: Speech,
  history: FindHistory,
  find: FindRecord,
): Promise<void> {
  speech.stop();
  await history.remove(find.id);
  if (find.audioUris?.length) {
    await speech.discardSaved(find.audioUris);
  }
}
