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

import type { FindRecord } from '@/domain/find';
import { GlassPanel } from '@/presentation/components/GlassPanel';
import type { FallTheme } from '@/presentation/theme';

interface HistoryDrawerProps {
  open: boolean;
  theme: FallTheme;
  finds: FindRecord[];
  onClose(): void;
  onSelect(find: FindRecord): void;
  onClear(): void;
}

export function HistoryDrawer({
  open,
  theme,
  finds,
  onClose,
  onSelect,
  onClear,
}: HistoryDrawerProps) {
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
          accessibilityLabel="Dismiss history"
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
          <Text style={[styles.eyebrow, { color: theme.gold }]}>Trail</Text>
          <Text style={[styles.heading, { color: theme.gold }]}>Past finds</Text>

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.list}
          >
            {finds.length === 0 ? (
              <Text style={[styles.empty, { color: theme.muted }]}>No finds yet. Go hunt.</Text>
            ) : (
              finds.map((find) => (
                <Pressable
                  key={find.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open find ${find.leafGuess ?? 'unnamed'}`}
                  onPress={() => onSelect(find)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Image source={{ uri: find.photoUri }} style={styles.thumb} />
                  <View style={styles.meta}>
                    <Text style={[styles.name, { color: theme.gold }]}>
                      {find.leafGuess ?? 'unnamed'}
                    </Text>
                    <View style={styles.dots}>
                      {find.colors.slice(0, 4).map((c) => (
                        <View
                          key={`${find.id}-${c.hex}`}
                          style={[styles.dot, { backgroundColor: c.hex }]}
                        />
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </Pressable>
              ))
            )}
          </ScrollView>

          {finds.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear history"
              onPress={onClear}
              style={({ pressed }) => [
                styles.clear,
                {
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.clearText, { color: theme.muted }]}>Clear history</Text>
            </Pressable>
          ) : null}
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
    paddingHorizontal: 20,
  },
  handle: { width: 42, height: 4, borderRadius: 2, marginBottom: 8, alignSelf: 'center' },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 12,
  },
  list: { gap: 10, paddingBottom: 12 },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  meta: { flex: 1, gap: 8 },
  name: { fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  clear: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  clearText: { fontSize: 15, fontWeight: '600' },
});
