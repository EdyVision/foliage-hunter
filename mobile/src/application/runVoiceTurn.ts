import { enrichSpeciesTraits } from '@/application/enrichSpeciesTraits';
import type { GuideTurn, VoiceRecording } from '@/domain/guide';
import type { GuideClient } from '@/ports/GuideClient';
import type { Speech } from '@/ports/Speech';

export async function runVoiceTurn(
  guide: GuideClient,
  speech: Speech,
  recording: VoiceRecording,
  options?: { speak?: boolean },
): Promise<GuideTurn> {
  const turn = await guide.voiceTurn(recording);
  const { turn: enriched, spoken } = enrichSpeciesTraits(turn);

  if (options?.speak !== false) {
    await speech.speak(spoken);
  }

  return enriched;
}
