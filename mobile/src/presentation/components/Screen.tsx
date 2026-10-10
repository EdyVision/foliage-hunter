import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassPanel } from '@/presentation/components/GlassPanel';
import type { FallTheme } from '@/presentation/theme';

export function Screen({
  title,
  eyebrow,
  theme,
  onOpenHistory,
  footer,
  children,
}: React.PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  theme: FallTheme;
  onOpenHistory?(): void;
  /** Pinned below the main body — does not move when the trail grows. */
  footer?: React.ReactNode;
}>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topSlot} />
        {onOpenHistory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open past finds"
            onPress={onOpenHistory}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <GlassPanel theme={theme} intensity={36} style={styles.historyBtn}>
              <Ionicons name="time-outline" size={22} color={theme.gold} />
            </GlassPanel>
          </Pressable>
        ) : (
          <View style={styles.topSlot} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.brand}>
          <Ionicons name="leaf" size={34} color={theme.gold} />
          <Text style={[styles.brandName, { color: theme.gold }]}>Foliage Hunter</Text>
        </View>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text> : null}
        {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
        {children}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 36,
  },
  topSlot: { width: 36, height: 36 },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
    overflow: 'visible',
  },
  footer: {
    flexShrink: 0,
    overflow: 'visible',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: -1.0,
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
  },
});
