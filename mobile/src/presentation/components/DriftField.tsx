import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Fade just before the bottom of the sky band (above "Go hunt."). */
const FADE_TAIL_PX = 8;

const LEAVES = [
  { color: '#9B2226', left: 0.1, size: 22, delay: 0, duration: 4800, sway: 16 },
  { color: '#E85D04', left: 0.26, size: 18, delay: 900, duration: 5400, sway: -14 },
  { color: '#F4A261', left: 0.44, size: 26, delay: 400, duration: 5000, sway: 12 },
  { color: '#FFBA08', left: 0.58, size: 20, delay: 1300, duration: 5800, sway: -18 },
  { color: '#2D6A4F', left: 0.74, size: 24, delay: 600, duration: 5200, sway: 10 },
  { color: '#C2410C', left: 0.34, size: 17, delay: 1600, duration: 6200, sway: -11 },
  { color: '#8B5E34', left: 0.66, size: 19, delay: 200, duration: 5600, sway: 14 },
] as const;

function FallingLeaf({
  color,
  left,
  size,
  delay,
  duration,
  sway,
  fieldHeight,
  fieldWidth,
}: {
  color: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
  sway: number;
  fieldHeight: number;
  fieldWidth: number;
}) {
  const progress = useSharedValue(0);
  const travel = Math.max(40, fieldHeight - FADE_TAIL_PX - size);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.in(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [delay, duration, progress, travel]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const y = p * travel;
    const x = Math.sin(p * Math.PI * 2.2) * sway;
    const rot = -24 + p * 52;

    let opacity = 0.42;
    if (p < 0.1) opacity = (p / 0.1) * 0.42;
    if (p > 0.88) opacity = 0.42 * (1 - (p - 0.88) / 0.12);

    return {
      opacity,
      transform: [{ translateY: y }, { translateX: x }, { rotate: `${rot}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.leaf,
        {
          left: fieldWidth * left,
          top: -size,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Ionicons name="leaf" size={size} color={color} />
    </Animated.View>
  );
}

/** Falling leaves for the top sky band — they stop before "Go hunt." */
export function DriftField() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={styles.field} pointerEvents="none" onLayout={onLayout}>
      {size.height > 0
        ? LEAVES.map((leaf, index) => (
            <FallingLeaf
              key={`${leaf.color}-${index}`}
              {...leaf}
              fieldHeight={size.height}
              fieldWidth={size.width}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  leaf: {
    position: 'absolute',
  },
});
