import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import type { SpeakOptions, Speech, SpokenAudio } from '@/ports/Speech';

/** Saved guide clips live here (survives cache purges, deleted with the find). */
const CLIP_DIR_NAME = 'foliage-clips/';

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export interface MagpieSpeechOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  voice?: string;
}

function normalizeForSpeech(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/…/g, '...')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extensionFor(mediaType: string): string {
  if (mediaType.includes('mpeg') || mediaType.includes('mp3')) return 'mp3';
  if (mediaType.includes('mp4') || mediaType.includes('m4a')) return 'm4a';
  return 'wav';
}

function normalizeOrigin(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '').replace(/\/v1$/i, '');
}

/** Hermes-safe: no lookbehind, coalesce short clauses for Magpie prosody. */
function splitForStream(text: string): string[] {
  const normalized = normalizeForSpeech(text);
  if (!normalized) return [];

  const raw: string[] = [];
  let start = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;
    if (ch === '.' || ch === '!' || ch === '?') {
      const next = normalized[i + 1];
      if (next === undefined || /\s/.test(next)) {
        const piece = normalized.slice(start, i + 1).trim();
        if (piece) raw.push(piece);
        start = i + 1;
        while (start < normalized.length && /\s/.test(normalized[start]!)) start += 1;
      }
    }
  }
  const tail = normalized.slice(start).trim();
  if (tail) raw.push(tail);
  if (raw.length === 0) return [normalized];

  const merged: string[] = [];
  let buf = '';
  for (const part of raw) {
    const next = buf ? `${buf} ${part}` : part;
    if (buf && next.length < 90) {
      buf = next;
      continue;
    }
    if (buf) merged.push(buf);
    buf = part;
  }
  if (buf) merged.push(buf);
  return merged;
}

/** RN-safe base64 (does not require global btoa). */
function uint8ToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return out;
}

function waitForPlayback(player: AudioPlayer, token: number, alive: () => number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { remove?: () => void } | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        subscription?.remove?.();
      } catch {
        // ignore
      }
      resolve();
    };

    if (typeof player.addListener === 'function') {
      subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (token !== alive()) {
          finish();
          return;
        }
        if (status.didJustFinish) finish();
      });
    }

    const started = Date.now();
    const tick = () => {
      if (settled) return;
      if (token !== alive()) {
        finish();
        return;
      }
      const duration = player.duration;
      const current = player.currentTime;
      if (Number.isFinite(duration) && duration > 0.15 && current >= duration - 0.05) {
        finish();
        return;
      }
      if (Date.now() - started > 60_000) {
        finish();
        return;
      }
      setTimeout(tick, 120);
    };
    setTimeout(tick, 160);
  });
}

export function createMagpieSpeech(options: MagpieSpeechOptions = {}): Speech {
  const origin = normalizeOrigin(options.baseUrl ?? '');
  const model = options.model?.trim() || 'magpie-tts';
  const voice = options.voice?.trim() || 'Aria';
  let player: AudioPlayer | null = null;
  let generation = 0;

  const releasePlayer = () => {
    if (!player) return;
    try {
      player.pause();
      player.remove();
    } catch {
      // ignore teardown races
    }
    player = null;
  };

  const fetchSpeechBase64 = async (text: string): Promise<{ base64: string; mediaType: string }> => {
    if (!origin) throw new Error('No TTS URL');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

    const response = await fetch(`${origin}/v1/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: 'wav',
      }),
    });

    if (!response.ok) {
      throw new Error((await response.text()) || `TTS failed (${response.status})`);
    }

    const mediaType = (response.headers.get('Content-Type') || 'audio/wav').split(';')[0]!;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { base64: uint8ToBase64(bytes), mediaType };
  };

  const playUri = async (uri: string, token: number) => {
    if (token !== generation) return;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    releasePlayer();
    player = createAudioPlayer({ uri });
    player.play();
  };

  /** Write a clip to disk and start it. Saved clips go to the documents dir, transient ones to cache. */
  const writeAndPlay = async (
    base64: string,
    mediaType: string,
    token: number,
    saveAs?: { key: string; index: number },
  ): Promise<string> => {
    let path: string;
    if (saveAs && FileSystem.documentDirectory) {
      const dir = `${FileSystem.documentDirectory}${CLIP_DIR_NAME}`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
      path = `${dir}${safeKey(saveAs.key)}-${saveAs.index}.${extensionFor(mediaType)}`;
    } else {
      const dir = FileSystem.cacheDirectory;
      if (!dir) throw new Error('No cache directory for TTS playback');
      path = `${dir}foliage-tts-${token}-${Date.now()}.${extensionFor(mediaType)}`;
    }

    await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
    await playUri(path, token);
    return path;
  };

  const allExist = async (uris: string[]): Promise<boolean> => {
    if (uris.length === 0) return false;
    const infos = await Promise.all(
      uris.map((uri) => FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }))),
    );
    return infos.every((info) => info.exists);
  };

  return {
    async speak(text: string, audio?: SpokenAudio, options?: SpeakOptions): Promise<void> {
      const token = ++generation;
      let firstStarted: (() => void) | undefined;
      const firstChunk = new Promise<void>((resolve) => {
        firstStarted = resolve;
      });

      const playSequence = async (uris: string[]) => {
        for (let i = 0; i < uris.length; i += 1) {
          if (token !== generation) return;
          await playUri(uris[i]!, token);
          if (i === 0) firstStarted?.();
          if (player && token === generation) {
            await waitForPlayback(player, token, () => generation);
          }
        }
      };

      const run = async () => {
        try {
          if (audio?.uris && (await allExist(audio.uris))) {
            await playSequence(audio.uris);
            return;
          }

          if (audio?.base64) {
            await writeAndPlay(audio.base64, audio.mediaType || 'audio/wav', token);
            firstStarted?.();
            if (player && token === generation) {
              await waitForPlayback(player, token, () => generation);
            }
            return;
          }

          const sentences = splitForStream(text);
          if (sentences.length === 0) {
            firstStarted?.();
            return;
          }

          const saved: string[] = [];
          let pending = fetchSpeechBase64(sentences[0]!);

          for (let i = 0; i < sentences.length; i += 1) {
            if (token !== generation) return;

            const clip = await pending;
            if (token !== generation) return;

            if (i + 1 < sentences.length) {
              pending = fetchSpeechBase64(sentences[i + 1]!);
            }

            const path = await writeAndPlay(
              clip.base64,
              clip.mediaType,
              token,
              options?.saveKey ? { key: options.saveKey, index: i } : undefined,
            );
            if (options?.saveKey) saved.push(path);
            if (i === 0) firstStarted?.();

            if (player && token === generation) {
              await waitForPlayback(player, token, () => generation);
            }
          }

          if (options?.saveKey && saved.length === sentences.length) {
            options.onSaved?.(saved);
          }
        } catch (cause) {
          console.warn(
            '[foliage] Magpie TTS failed:',
            cause instanceof Error ? cause.message : cause,
          );
          firstStarted?.();
        }
      };

      void run();
      return firstChunk;
    },
    stop(): void {
      generation += 1;
      releasePlayer();
    },
    async discardSaved(uris: string[]): Promise<void> {
      await Promise.all(
        uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)),
      );
    },
  };
}
