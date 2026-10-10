import * as SpeechApi from 'expo-speech';

import type { Speech } from '@/ports/Speech';

export function createExpoSpeech(): Speech {
  return {
    async speak(text: string): Promise<void> {
      try {
        SpeechApi.stop();
        SpeechApi.speak(text, {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.96,
          onError: () => {
            // Device TTS voice download / network glitches should not crash the UI.
          },
        });
      } catch {
        // ignore
      }
    },
    stop(): void {
      try {
        SpeechApi.stop();
      } catch {
        // ignore
      }
    },
    async discardSaved(): Promise<void> {
      // Device TTS never saves clips.
    },
  };
}
