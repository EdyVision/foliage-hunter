import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spokenWithTraits } from '@/application/enrichSpeciesTraits';
import type { GuideTurn, VoiceRecording } from '@/domain/guide';
import { LeafSpinner } from '@/presentation/components/LeafSpinner';
import type { FallTheme } from '@/presentation/theme';
import type { Speech } from '@/ports/Speech';

interface VoiceDockProps {
  open: boolean;
  onOpen(): void;
  onClose(): void;
  theme: FallTheme;
  speech: Speech;
  /** Floating mic FAB. Off when mic lives in the find drawer. */
  showLauncher?: boolean;
  onTurn(recording: VoiceRecording): Promise<GuideTurn>;
}

const recorderOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export function VoiceDock({ open, onOpen, onClose, onTurn, speech, theme, showLauncher = true }: VoiceDockProps) {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking'>('idle');
  const [exchange, setExchange] = useState<GuideTurn | null>(null);
  const [error, setError] = useState('');
  const speechDetected = useRef(false);
  const lastSpeechAt = useRef(0);
  const finishing = useRef(false);

  const finish = useCallback(async () => {
    if (finishing.current || !recorder.isRecording) return;
    finishing.current = true;
    setStatus('thinking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!speechDetected.current || !uri) {
        throw new Error('I did not hear enough speech. Try again when it says listening.');
      }
      const result = await onTurn({ uri, name: 'foliage.m4a', mediaType: 'audio/mp4' });
      setExchange(result);
      await speech.speak(spokenWithTraits(result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process that recording.');
    } finally {
      setStatus('idle');
      finishing.current = false;
    }
  }, [onTurn, recorder, speech]);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    const now = Date.now();
    if ((recorderState.metering ?? -160) > -44) {
      speechDetected.current = true;
      lastSpeechAt.current = now;
    }
    if (
      speechDetected.current &&
      now - lastSpeechAt.current >= 900 &&
      recorderState.durationMillis >= 500
    ) {
      void finish();
    }
  }, [finish, recorderState.durationMillis, recorderState.isRecording, recorderState.metering]);

  const toggle = async () => {
    setError('');
    speech.stop();
    if (recorder.isRecording) return finish();
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access is required for voice.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    speechDetected.current = false;
    lastSpeechAt.current = Date.now();
    recorder.record({ forDuration: 20 });
    setStatus('listening');
  };

  const close = () => {
    speech.stop();
    onClose();
  };

  return (
    <>
      {showLauncher ? (
        <Pressable
          accessibilityLabel="Open foliage voice guide"
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.launcher,
            {
              bottom: insets.bottom + 29,
              backgroundColor: theme.elevated,
              borderColor: theme.gold + '99',
              opacity: pressed ? 0.82 : 1,
              shadowColor: theme.gold,
            },
          ]}
        >
          <Ionicons name="mic" size={30} color={theme.accentBright} />
        </Pressable>
      ) : null}
      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={close}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close voice controls"
            style={styles.dismissLayer}
            onPress={close}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.modalSurface,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              contentContainerStyle={styles.content}
              style={styles.scroll}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recorder.isRecording ? 'Stop listening' : 'Talk to guide'}
                onPress={() => void toggle()}
                disabled={status === 'thinking'}
                style={[styles.voiceOrb, { backgroundColor: theme.elevated, borderColor: theme.gold + '99' }]}
              >
                <Ionicons
                  name={recorder.isRecording ? 'stop' : 'mic'}
                  size={32}
                  color={theme.accentBright}
                />
              </Pressable>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>
                {status === 'listening' ? 'Listening' : status === 'thinking' ? 'Thinking' : 'Leaf guide'}
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>Ask what you found</Text>
              <Text style={[styles.copy, { color: theme.muted }]}>
                {exchange?.reply ??
                  'Hold the leaf up, tap the mic, and ask. I will guess the tree and nudge you back outside.'}
              </Text>
              {exchange ? (
                <Text style={[styles.transcript, { color: theme.muted }]}>You: {exchange.transcript}</Text>
              ) : null}
              {exchange?.leafGuess ? (
                <Text style={[styles.guess, { color: theme.gold }]}>Guess: {exchange.leafGuess}</Text>
              ) : null}
              {exchange?.traits ? (
                <Text style={[styles.copy, { color: theme.muted }]}>
                  {exchange.traits.note}
                </Text>
              ) : null}
              {error ? (
                <Text accessibilityRole="alert" style={[styles.copy, { color: theme.critical }]}>
                  {error}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LeafSpinner visible={status === 'thinking'} theme={theme} />
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    position: 'absolute',
    left: '50%',
    marginLeft: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismissLayer: { position: 'absolute', inset: 0, backgroundColor: '#00000094' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 12,
  },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: 24, alignItems: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, marginBottom: 26, alignSelf: 'center' },
  voiceOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: { fontSize: 25, fontWeight: '600', letterSpacing: -0.6, textAlign: 'center' },
  copy: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360, marginTop: 12 },
  transcript: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14 },
  guess: { fontSize: 14, fontWeight: '700', marginTop: 10, textTransform: 'capitalize' },
  close: {
    minWidth: 140,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  closeText: { fontSize: 15, fontWeight: '600' },
});
