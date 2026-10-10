import type { GuideTurn, LeafPhoto, VoiceRecording } from '@/domain/guide';
import type { GuideClient } from '@/ports/GuideClient';

const LEAVES = [
  {
    name: 'sugar maple',
    reply:
      'That looks like a sugar maple leaf! Five lobes, sharp tips, classic fall scarlet.',
  },
  {
    name: 'red oak',
    reply:
      'Hmm — pointed lobes like a red oak. The fall bronze on those is hard to miss. Look for another one nearby.',
  },
  {
    name: 'sweetgum',
    reply:
      'Star-shaped with five points — that is sweetgum. They go purple and gold at once. Nice find.',
  },
  {
    name: 'ginkgo',
    reply:
      'Fan shape, almost like a little paper kite. That is a ginkgo leaf. Rare treat on a city walk.',
  },
  {
    name: 'aspen',
    reply:
      'Round with a flat stem — aspen. They flutter even when the wind feels still. You are outside; stay a minute.',
  },
] as const;

let leafIndex = 0;

function nextDemo(transcript: string): GuideTurn {
  const leaf = LEAVES[leafIndex % LEAVES.length]!;
  leafIndex += 1;
  return {
    transcript,
    reply: leaf.reply,
    leafGuess: leaf.name,
  };
}

export function createDemoGuideClient(): GuideClient {
  return {
    async identifyPhoto(_photo: LeafPhoto, prompt?: string): Promise<GuideTurn> {
      await new Promise((r) => setTimeout(r, 450));
      return nextDemo(prompt?.trim() || '(demo photo)');
    },
    async voiceTurn(_recording: VoiceRecording): Promise<GuideTurn> {
      await new Promise((r) => setTimeout(r, 450));
      return nextDemo('(demo) What leaf is this?');
    },
  };
}
