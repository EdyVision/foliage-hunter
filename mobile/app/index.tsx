import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { exportFindPhoto } from '@/application/exportFindPhoto';
import { identifyLeaf } from '@/application/identifyLeaf';
import { newFindId, recordFind } from '@/application/recordFind';
import { deleteFind, replayFind } from '@/application/replayFind';
import { runVoiceTurn as runVoiceTurnUseCase } from '@/application/runVoiceTurn';
import { createAppPorts } from '@/composition/wire';
import { formatPlace, type FindRecord } from '@/domain/find';
import type { GuideTurn, LeafPhoto, VoiceRecording } from '@/domain/guide';
import { lookupSpeciesTraits } from '@/domain/speciesTraits';
import { AmbientWash } from '@/presentation/components/AmbientWash';
import { DriftField } from '@/presentation/components/DriftField';
import { FindDrawer } from '@/presentation/components/FindDrawer';
import { HistoryDrawer } from '@/presentation/components/HistoryDrawer';
import { HuntJourney } from '@/presentation/components/HuntJourney';
import { HuntOrb } from '@/presentation/components/HuntOrb';
import { LeafSpinner } from '@/presentation/components/LeafSpinner';
import { Screen } from '@/presentation/components/Screen';
import { VoiceDock } from '@/presentation/components/VoiceDock';
import { useFallTheme } from '@/presentation/theme';

const ports = createAppPorts();

export default function HomeScreen() {
  const theme = useFallTheme();
  const insets = useSafeAreaInsets();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [turn, setTurn] = useState<GuideTurn | null>(null);
  const [activeFindId, setActiveFindId] = useState<string | null>(null);
  const [finds, setFinds] = useState<FindRecord[]>([]);

  const refreshHistory = useCallback(async () => {
    setFinds(await ports.history.list());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ports.history.list().then((records) => {
      if (!cancelled) setFinds(records);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onTurn = useCallback(async (recording: VoiceRecording) => {
    return runVoiceTurnUseCase(ports.guide, ports.speech, recording, { speak: false });
  }, []);

  const runIdentify = useCallback(async (photo: LeafPhoto) => {
    setError('');
    setBusy(true);
    ports.speech.stop();
    try {
      setPhotoUri(photo.uri);
      const findId = newFindId();
      // GPS fix runs alongside the model call; a null result never blocks the find.
      const locating = ports.locator.locate();
      // No client prompt: foliage guide-server applies its species-catalog prompt.
      const result = await identifyLeaf(ports.guide, ports.speech, photo, {
        palette: ports.palette,
        speakOptions: {
          saveKey: findId,
          onSaved: (uris) => {
            void ports.history.update(findId, { audioUris: uris }).then(refreshHistory);
          },
        },
      });
      setTurn(result);
      const location = await locating;
      const saved = await recordFind(ports.history, photo.uri, result, { id: findId, location });
      setActiveFindId(saved.id);
      await refreshHistory();
      setDrawerOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not identify that leaf.');
    } finally {
      setBusy(false);
    }
  }, [refreshHistory]);

  const onHuntPress = useCallback(() => {
    Alert.alert('Add a leaf', 'Take a photo or choose one from your library.', [
      {
        text: 'Take photo',
        onPress: () => {
          void (async () => {
            try {
              const photo = await ports.camera.captureLeaf();
              if (photo) await runIdentify(photo);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Camera failed.');
            }
          })();
        },
      },
      {
        text: 'Choose photo',
        onPress: () => {
          void (async () => {
            try {
              const photo = await ports.camera.pickLeaf();
              if (photo) await runIdentify(photo);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Library failed.');
            }
          })();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runIdentify]);

  const openFind = useCallback((find: FindRecord) => {
    setHistoryOpen(false);
    setActiveFindId(find.id);
    setPhotoUri(find.photoUri);
    setTurn({
      transcript: '(history)',
      reply: find.reply,
      leafGuess: find.leafGuess,
      colors: find.colors,
      traits: lookupSpeciesTraits(find.leafGuess),
    });
    setDrawerOpen(true);
  }, []);

  const activeFind = finds.find((f) => f.id === activeFindId) ?? null;

  const replayActiveFind = useCallback(() => {
    if (!activeFind) return;
    void replayFind(ports.speech, ports.history, activeFind).then(refreshHistory);
  }, [activeFind, refreshHistory]);

  const deleteActiveFind = useCallback(() => {
    if (!activeFind) return;
    Alert.alert('Delete this find?', 'It will be removed from your trail history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteFind(ports.speech, ports.history, activeFind);
            setFinds((prev) => prev.filter((f) => f.id !== activeFind.id));
            setActiveFindId(null);
            setPhotoUri(null);
            setTurn(null);
            setDrawerOpen(false);
          })();
        },
      },
    ]);
  }, [activeFind]);

  const clearHistory = useCallback(() => {
    Alert.alert('Clear history?', 'This removes every past find from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
          onPress: () => {
          void (async () => {
            ports.speech.stop();
            const clips = finds.flatMap((f) => f.audioUris ?? []);
            await ports.history.clear();
            await ports.speech.discardSaved(clips);
            setFinds([]);
            setHistoryOpen(false);
          })();
        },
      },
    ]);
  }, [finds]);

  // Sky band from the true window top (above status bar + history) down to "Go hunt."
  const leafSkyHeight = insets.top + 132;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AmbientWash theme={theme} />

      <View
        pointerEvents="none"
        style={[styles.leafSky, { height: leafSkyHeight }]}
      >
        <DriftField />
      </View>

      <Screen
        theme={theme}
        onOpenHistory={() => setHistoryOpen(true)}
        footer={
          <View style={[styles.thumbZone, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <HuntOrb theme={theme} busy={busy} onPress={onHuntPress} />
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.critical }]}>
                {error}
              </Text>
            ) : null}
          </View>
        }
      >
        <Text style={[styles.copy, { color: theme.muted }]}>
          Go hunt. Snap a leaf. We name the tree and pull the colors from the shot.
        </Text>

        <HuntJourney
          theme={theme}
          finds={finds}
          onSelect={openFind}
          onHunt={onHuntPress}
        />
      </Screen>

      <FindDrawer
        open={drawerOpen}
        theme={theme}
        photoUri={photoUri}
        turn={turn}
        onClose={() => setDrawerOpen(false)}
        onAskVoice={() => {
          setDrawerOpen(false);
          setVoiceOpen(true);
        }}
        onDelete={activeFind ? deleteActiveFind : undefined}
        onReplay={activeFind ? replayActiveFind : undefined}
        onShare={
          photoUri
            ? () => exportFindPhoto(ports.photoShare, photoUri)
            : undefined
        }
        place={formatPlace(activeFind?.location)}
      />

      <HistoryDrawer
        open={historyOpen}
        theme={theme}
        finds={finds}
        onClose={() => setHistoryOpen(false)}
        onSelect={openFind}
        onClear={clearHistory}
      />

      <VoiceDock
        open={voiceOpen}
        onOpen={() => setVoiceOpen(true)}
        onClose={() => setVoiceOpen(false)}
        onTurn={onTurn}
        speech={ports.speech}
        theme={theme}
        showLauncher={false}
      />

      <LeafSpinner visible={busy} theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  leafSky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  copy: {
    flexShrink: 0,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 340,
    textAlign: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  thumbZone: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    paddingTop: 0,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
