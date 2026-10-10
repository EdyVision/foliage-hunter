import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { FallTheme } from '@/presentation/theme';

const LEAF_COLORS = [
  '#9B2226',
  '#C2410C',
  '#E85D04',
  '#F4A261',
  '#FFBA08',
  '#2D6A4F',
  '#8B5E34',
  '#6A040F',
] as const;

const RING_SIZE = 168;
const LEAF_RADIUS = 58;
const LEAF_SIZE = 28;

interface LeafSpinnerProps {
  visible: boolean;
  theme: FallTheme;
  /** Accessibility only — nothing is shown on screen. */
  accessibilityLabel?: string;
}

/**
 * Busy veil: opaque wash + colorful leaf wreath that spins while growing/shrinking.
 */
export function LeafSpinner({
  visible,
  theme: _theme,
  accessibilityLabel = 'Working',
}: LeafSpinnerProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(rotation);
      cancelAnimation(scale);
      rotation.value = 0;
      scale.value = 1;
      return;
    }

    rotation.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
    scale.value = withRepeat(
      withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [rotation, scale, visible]);

  const wreathStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        style={styles.veil}
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View style={[styles.ring, wreathStyle]}>
          {LEAF_COLORS.map((color, index) => {
            const angle = (index / LEAF_COLORS.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * LEAF_RADIUS;
            const y = Math.sin(angle) * LEAF_RADIUS;
            return (
              <View
                key={`${color}-${index}`}
                style={[
                  styles.leafSlot,
                  {
                    transform: [
                      { translateX: x },
                      { translateY: y },
                      { rotate: `${(angle * 180) / Math.PI + 90}deg` },
                    ],
                    shadowColor: color,
                  },
                ]}
              >
                <Ionicons name="leaf" size={LEAF_SIZE} color={color} style={styles.leafIcon} />
              </View>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: {
    flex: 1,
    backgroundColor: '#101412F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafSlot: {
    position: 'absolute',
    width: LEAF_SIZE + 8,
    height: LEAF_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  leafIcon: {
    textShadowColor: '#00000066',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
