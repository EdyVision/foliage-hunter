import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GuideTurn } from '@/domain/guide';
import { GlassPanel } from '@/presentation/components/GlassPanel';
import { LeafFindCard } from '@/presentation/components/LeafFindCard';
import type { FallTheme } from '@/presentation/theme';

interface FindDrawerProps {
  open: boolean;
  theme: FallTheme;
  photoUri: string | null;
  turn: GuideTurn | null;
  onClose(): void;
  onAskVoice(): void;
  /** When set, show trash over the preview photo. */
  onDelete?(): void;
  /** When set, show a speaker over the preview photo that replays the guide. */
  onReplay?(): void;
  /** When set, show a share control over the preview photo. */
  onShare?(): void;
  /** "Castle Rock, CO" or rounded coordinates; hidden when the find has no location. */
  place?: string;
}

export function FindDrawer({
  open,
  theme,
  photoUri,
  turn,
  onClose,
  onAskVoice,
  onDelete,
  onReplay,
  onShare,
  place,
}: FindDrawerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      transparent
      visible={open}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss find drawer"
          style={styles.dismissLayer}
          onPress={onClose}
        />
        <GlassPanel
          theme={theme}
          intensity={56}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.gold + '66' }]} />
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.content}
          >
            {photoUri ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.preview}
                  accessibilityLabel="Leaf photo"
                />
                <View style={styles.photoActions}>
                  {onShare ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Share or save this photo"
                      onPress={onShare}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.photoBtn,
                        {
                          backgroundColor: theme.elevated,
                          borderColor: theme.gold + '99',
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="share-outline" size={18} color={theme.gold} />
                    </Pressable>
                  ) : null}
                  {onReplay ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Replay the guide"
                      onPress={onReplay}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.photoBtn,
                        {
                          backgroundColor: theme.elevated,
                          borderColor: theme.gold + '99',
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="volume-high-outline" size={18} color={theme.gold} />
                    </Pressable>
                  ) : null}
                  {onDelete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete this find"
                      onPress={onDelete}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.photoBtn,
                        {
                          backgroundColor: theme.elevated,
                          borderColor: theme.gold + '99',
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.gold} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {place ? (
              <View style={styles.placeRow}>
                <Ionicons name="location-outline" size={14} color={theme.gold} />
                <Text style={[styles.placeText, { color: theme.muted }]}>{place}</Text>
              </View>
            ) : null}

            {turn ? <LeafFindCard theme={theme} turn={turn} /> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask with voice"
              onPress={onAskVoice}
              style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
            >
              <GlassPanel theme={theme} intensity={36} style={styles.micOrb}>
                <Ionicons name="mic-outline" size={28} color={theme.gold} />
              </GlassPanel>
            </Pressable>
            <Text style={[styles.micHint, { color: theme.muted }]}>Ask the guide</Text>

            <Text style={[styles.aiDisclaimer, { color: theme.muted }]}>
              AI can make mistakes, please consult with a licensed professional.
            </Text>
          </ScrollView>
        </GlassPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismissLayer: { position: 'absolute', inset: 0, backgroundColor: '#00000094' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  handle: { width: 42, height: 4, borderRadius: 2, marginBottom: 8, alignSelf: 'center' },
  content: { paddingHorizontal: 24, alignItems: 'center', paddingBottom: 12 },
  previewWrap: {
    width: '100%',
    marginBottom: 14,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 18,
  },
  photoActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: -6,
    marginBottom: 12,
  },
  placeText: { fontSize: 13 },
  photoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  micOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micHint: { fontSize: 13, marginTop: 10, marginBottom: 8 },
  aiDisclaimer: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
});
