import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlassPanel } from '@/presentation/components/GlassPanel';
import type { FallTheme } from '@/presentation/theme';

const ORB_SIZE = 64;
const ICON_SIZE = 28;

interface HuntOrbProps {
  theme: FallTheme;
  busy: boolean;
  onPress(): void;
}

export function HuntOrb({ theme, busy, onPress }: HuntOrbProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (busy) {
      pulse.value = withRepeat(
        withTiming(0.92, { duration: 780, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }
    cancelAnimation(pulse);
    pulse.value = withTiming(1, { duration: 220 });
  }, [busy, pulse]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={orbStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Reading leaf' : 'Snap a leaf'}
          disabled={busy}
          onPress={onPress}
          style={({ pressed }) => [{ opacity: pressed || busy ? 0.75 : 1 }]}
        >
          <GlassPanel theme={theme} intensity={36} style={styles.orb}>
            <Ionicons
              name={busy ? 'leaf' : 'camera-outline'}
              size={ICON_SIZE}
              color={theme.gold}
            />
          </GlassPanel>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
