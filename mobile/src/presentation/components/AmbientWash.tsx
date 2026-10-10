import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { FallTheme } from '@/presentation/theme';

interface AmbientWashProps {
  theme: FallTheme;
}

/** Soft autumn blooms that spill past the edges (no clipped corner blobs). */
export function AmbientWash({ theme }: AmbientWashProps) {
  const { width, height } = useWindowDimensions();
  // Draw larger than the screen so every bloom fades off-canvas, not mid-corner.
  const pad = Math.max(width, height) * 0.28;
  const w = width + pad * 2;
  const h = height + pad * 2;

  return (
    <View pointerEvents="none" style={[styles.wrap, { left: -pad, top: -pad, width: w, height: h }]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="washGold" cx="50%" cy="22%" r="48%">
            <Stop offset="0%" stopColor={theme.accentBright} stopOpacity={0.2} />
            <Stop offset="55%" stopColor={theme.accentBright} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={theme.accentBright} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="washScarlet" cx="22%" cy="58%" r="46%">
            <Stop offset="0%" stopColor={theme.crimson} stopOpacity={0.26} />
            <Stop offset="60%" stopColor={theme.crimson} stopOpacity={0.07} />
            <Stop offset="100%" stopColor={theme.crimson} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="washForest" cx="86%" cy="52%" r="50%">
            <Stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.28} />
            <Stop offset="55%" stopColor="#2D6A4F" stopOpacity={0.07} />
            <Stop offset="100%" stopColor="#2D6A4F" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="washRust" cx="72%" cy="88%" r="48%">
            <Stop offset="0%" stopColor={theme.rust} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={theme.rust} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={w * 0.5} cy={h * 0.2} r={w * 0.5} fill="url(#washGold)" />
        <Circle cx={w * 0.2} cy={h * 0.55} r={w * 0.48} fill="url(#washScarlet)" />
        <Circle cx={w * 0.9} cy={h * 0.5} r={w * 0.52} fill="url(#washForest)" />
        <Circle cx={w * 0.75} cy={h * 0.9} r={w * 0.5} fill="url(#washRust)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 0,
  },
});
