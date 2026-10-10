import type { GuideTurn, LeafPhoto, VoiceRecording } from '@/domain/guide';

export interface GuideClient {
  identifyPhoto(photo: LeafPhoto, prompt?: string): Promise<GuideTurn>;
  voiceTurn(recording: VoiceRecording): Promise<GuideTurn>;
}
