import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FallTheme } from '@/presentation/theme';

interface GlassPanelProps {
  theme: FallTheme;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Frosted charcoal glass — blur on iOS, translucent wash elsewhere. */
export function GlassPanel({ theme, intensity = 42, style, children }: GlassPanelProps) {
  const border = { borderColor: theme.glassBorder };

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={[styles.base, border, style]}>
        <View pointerEvents="none" style={[styles.tint, { backgroundColor: theme.glass }]} />
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[styles.base, border, { backgroundColor: theme.glass }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
