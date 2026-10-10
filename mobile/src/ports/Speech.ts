/**
 * Audio to play instead of synthesizing `text`. Either a provider-supplied clip
 * (`base64`) or previously saved clip files (`uris`, played in order).
 */
export interface SpokenAudio {
  base64?: string;
  mediaType?: string;
  uris?: string[];
}

export interface SpeakOptions {
  /**
   * Persist every synthesized clip under this key (e.g. the find id) and report
   * the file URIs once the whole reply has been synthesized. Adapters that cannot
   * save (device TTS) ignore it.
   */
  saveKey?: string;
  onSaved?(uris: string[]): void;
}

export interface Speech {
  /**
   * Play `audio` when present (saved clips or provider WAV); otherwise synthesize
   * `text` sentence by sentence. Resolves when the first chunk starts playing so
   * callers can drop a busy indicator early.
   */
  speak(text: string, audio?: SpokenAudio, options?: SpeakOptions): Promise<void>;
  stop(): void;
  /** Delete clips previously reported through `onSaved`. Missing files are fine. */
  discardSaved(uris: string[]): Promise<void>;
}
