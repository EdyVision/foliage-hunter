import Constants from 'expo-constants';

import { createExpoCamera } from '@/adapters/camera/expoImagePicker';
import { createDemoGuideClient } from '@/adapters/guide/demoGuideClient';
import { createHttpGuideClient } from '@/adapters/guide/httpGuideClient';
import { createAsyncFindHistory } from '@/adapters/history/asyncFindHistory';
import { createExpoLocator } from '@/adapters/location/expoLocator';
import { createJpegPaletteReader } from '@/adapters/palette/jpegPaletteReader';
import { createExpoPhotoShare } from '@/adapters/share/expoPhotoShare';
import { createExpoSpeech } from '@/adapters/speech/expoSpeech';
import { createMagpieSpeech } from '@/adapters/speech/magpieSpeech';
import type { GuideTurn, LeafPhoto, VoiceRecording } from '@/domain/guide';
import type { Camera } from '@/ports/Camera';
import type { FindHistory } from '@/ports/FindHistory';
import type { GuideClient } from '@/ports/GuideClient';
import type { Locator } from '@/ports/Locator';
import type { PaletteReader } from '@/ports/PaletteReader';
import type { PhotoShare } from '@/ports/PhotoShare';
import type { Speech } from '@/ports/Speech';

export interface AppPorts {
  guide: GuideClient;
  speech: Speech;
  camera: Camera;
  palette: PaletteReader;
  history: FindHistory;
  locator: Locator;
  photoShare: PhotoShare;
}

function guideUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as { guideUrl?: string } | undefined;
  const raw = process.env.EXPO_PUBLIC_GUIDE_URL ?? extra?.guideUrl;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed || undefined;
}

function ttsUrl(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_TTS_URL?.trim() || guideUrl();
  return raw || undefined;
}

function guideApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_GUIDE_API_KEY?.trim();
  return key || undefined;
}

function guideModel(): string {
  return process.env.EXPO_PUBLIC_GUIDE_MODEL?.trim() || 'gemma-foliage';
}

function ttsModel(): string {
  return process.env.EXPO_PUBLIC_TTS_MODEL?.trim() || 'magpie-tts';
}

function ttsVoice(): string {
  // Measured on our Magpie GGUF server: Aria is the one male speaker (~97 Hz);
  // John / Jason / Leo come back female there. Speaker names are not reliable labels.
  return process.env.EXPO_PUBLIC_TTS_VOICE?.trim() || 'Aria';
}

function createSpeech(): Speech {
  const url = ttsUrl();
  if (!url) {
    console.warn(
      '[foliage] No EXPO_PUBLIC_TTS_URL / EXPO_PUBLIC_GUIDE_URL — using device TTS.',
    );
    return createExpoSpeech();
  }
  return createMagpieSpeech({
    baseUrl: url,
    apiKey: guideApiKey(),
    model: ttsModel(),
    voice: ttsVoice(),
  });
}

function networkMessage(url: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : 'fetch failed';
  return new Error(
    `Guide unreachable (${url}). From this device, open that host in Safari or curl /v1/models. Tailscale must be up on the phone/simulator host. Or clear EXPO_PUBLIC_GUIDE_URL for offline demo. ${detail}`,
  );
}

function isNetworkFailure(cause: unknown): boolean {
  const msg = cause instanceof Error ? cause.message : String(cause);
  return /fetch failed|network|could not connect|failed to connect|timed out|Network request failed/i.test(
    msg,
  );
}

function createResilientGuide(url: string): GuideClient {
  const http = createHttpGuideClient({
    baseUrl: url,
    apiKey: guideApiKey(),
    model: guideModel(),
  });
  const demo = createDemoGuideClient();

  return {
    async identifyPhoto(photo: LeafPhoto, prompt?: string): Promise<GuideTurn> {
      try {
        return await http.identifyPhoto(photo, prompt);
      } catch (cause) {
        if (isNetworkFailure(cause)) throw networkMessage(url, cause);
        throw cause instanceof Error ? cause : new Error(String(cause));
      }
    },
    async voiceTurn(recording: VoiceRecording): Promise<GuideTurn> {
      try {
        return await http.voiceTurn(recording);
      } catch {
        return demo.voiceTurn(recording);
      }
    },
  };
}

export function createAppPorts(): AppPorts {
  const url = guideUrl();
  return {
    guide: url ? createResilientGuide(url) : createDemoGuideClient(),
    speech: createSpeech(),
    camera: createExpoCamera(),
    palette: createJpegPaletteReader(),
    history: createAsyncFindHistory(),
    locator: createExpoLocator(),
    photoShare: createExpoPhotoShare(),
  };
}
