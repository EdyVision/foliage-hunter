import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { FindRecord } from '@/domain/find';
import type { FallTheme } from '@/presentation/theme';

type Pt = { x: number; y: number };

/** Soft forest-floor lift — atmosphere, not a glass card. */
function TrailAtmosphere() {
  return (
    <Svg pointerEvents="none" style={styles.atmosphere} width="100%" height="100%">
      <Defs>
        <RadialGradient id="trailFloor" cx="50%" cy="48%" rx="72%" ry="58%">
          <Stop offset="0%" stopColor="#F4F1EA" stopOpacity={0.07} />
          <Stop offset="45%" stopColor="#2D6A4F" stopOpacity={0.05} />
          <Stop offset="78%" stopColor="#101412" stopOpacity={0.02} />
          <Stop offset="100%" stopColor="#101412" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#trailFloor)" />
    </Svg>
  );
}

interface HuntJourneyProps {
  theme: FallTheme;
  finds: FindRecord[];
  onSelect?(find: FindRecord): void;
  onHunt?(): void;
}

type LabelSide = 'above' | 'below';

type TrailStop =
  | { kind: 'find'; find: FindRecord; label: string; x: number; y: number; labelSide: LabelSide }
  | { kind: 'ghost'; label: string; x: number; y: number; labelSide: LabelSide }
  | { kind: 'pending'; x: number; y: number; labelSide: LabelSide };

const NODE = 48;
const STOP_W = 96;
const SCREEN_PAD = 20;
/** Room above/below the path so labels are not clipped by the scroll edge. */
const STAGE_EDGE = 28;
/** How many past finds sit on the curve (plus one pending tip). */
const MAX_FINDS_ON_TRAIL = 10;

function stageHeightForStops(stopCount: number): number {
  return Math.max(280, 160 + stopCount * 52);
}

/** One cubic Bézier: start, two control points, end. */
type Cubic = { p0: Pt; c1: Pt; c2: Pt; p1: Pt };

/**
 * Squiggly BL → TR trail as explicit cubic segments. The SVG `d` string and the
 * orb positions are both derived from this one list, so orbs always sit on the
 * dotted line. Written as `C` + `S` (reflected control point) in SVG terms.
 */
function trailCubics(width: number, height: number): Cubic[] {
  const w = width;
  const h = height;
  const pt = (x: number, y: number): Pt => ({ x: w * x, y: h * y });

  const start = pt(0.08, 0.92);
  const first: Cubic = { p0: start, c1: pt(0.3, 1.02), c2: pt(0.7, 0.96), p1: pt(0.82, 0.84) };

  // Each `S` segment: [second control point, end point]; c1 mirrors previous c2.
  const smooth: [Pt, Pt][] = [
    [pt(0.95, 0.72), pt(0.7, 0.68)],
    [pt(0.1, 0.6), pt(0.28, 0.54)],
    [pt(0.92, 0.46), pt(0.78, 0.4)],
    [pt(0.12, 0.32), pt(0.3, 0.26)],
    [pt(0.9, 0.16), pt(0.92, 0.08)],
  ];

  const cubics: Cubic[] = [first];
  for (const [c2, p1] of smooth) {
    const prev = cubics[cubics.length - 1]!;
    const c1 = { x: 2 * prev.p1.x - prev.c2.x, y: 2 * prev.p1.y - prev.c2.y };
    cubics.push({ p0: prev.p1, c1, c2, p1 });
  }
  return cubics;
}

function trailPathD(cubics: Cubic[]): string {
  const first = cubics[0];
  if (!first) return '';
  const parts = [`M ${first.p0.x} ${first.p0.y}`];
  for (const c of cubics) {
    parts.push(`C ${c.c1.x} ${c.c1.y}, ${c.c2.x} ${c.c2.y}, ${c.p1.x} ${c.p1.y}`);
  }
  return parts.join(' ');
}

function cubicAt(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const cc = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * c.p0.x + b * c.c1.x + cc * c.c2.x + d * c.p1.x,
    y: a * c.p0.y + b * c.c1.y + cc * c.c2.y + d * c.p1.y,
  };
}

/** Flatten the curve into a dense polyline, then place `count` stops evenly by arc length. */
function pointsOnCubics(cubics: Cubic[], count: number): Pt[] {
  if (count <= 0 || cubics.length === 0) return [];

  const STEPS = 48;
  const poly: Pt[] = [];
  for (const c of cubics) {
    for (let s = 0; s < STEPS; s += 1) poly.push(cubicAt(c, s / STEPS));
  }
  poly.push(cubics[cubics.length - 1]!.p1);

  const cumulative: number[] = [0];
  for (let i = 1; i < poly.length; i += 1) {
    const a = poly[i - 1]!;
    const b = poly[i]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cumulative[cumulative.length - 1]!;
  if (total <= 0) return Array.from({ length: count }, () => ({ ...poly[0]! }));

  const inset = 0.03;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const target = (inset + t * (1 - 2 * inset)) * total;

    let k = 1;
    while (k < cumulative.length - 1 && cumulative[k]! < target) k += 1;
    const a = poly[k - 1]!;
    const b = poly[k]!;
    const segLen = cumulative[k]! - cumulative[k - 1]!;
    const u = segLen > 0 ? (target - cumulative[k - 1]!) / segLen : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  });
}

function composeTrail(finds: FindRecord[], width: number) {
  const shown = finds.slice(0, MAX_FINDS_ON_TRAIL);
  const empty = shown.length === 0;
  const stopCount = empty ? 4 : shown.length + 1;
  const height = stageHeightForStops(stopCount);
  const cubics = trailCubics(width, height);
  const d = trailPathD(cubics);
  const points = pointsOnCubics(cubics, stopCount);
  const labelSide = (i: number): LabelSide => (i % 2 === 0 ? 'below' : 'above');

  let stops: TrailStop[];
  if (empty) {
    const ghosts = (['Start', 'Snap', 'Name'] as const).map((label, i) => ({
      kind: 'ghost' as const,
      label,
      x: points[i]!.x,
      y: points[i]!.y,
      labelSide: labelSide(i),
    }));
    stops = [
      ...ghosts,
      {
        kind: 'pending',
        x: points[3]!.x,
        y: points[3]!.y,
        labelSide: labelSide(3),
      },
    ];
  } else {
    stops = [
      ...shown.map((find, i) => ({
        kind: 'find' as const,
        find,
        label: find.leafGuess ?? 'find',
        x: points[i]!.x,
        y: points[i]!.y,
        labelSide: labelSide(i),
      })),
      {
        kind: 'pending',
        x: points[shown.length]!.x,
        y: points[shown.length]!.y,
        labelSide: labelSide(shown.length),
      },
    ];
  }

  return { d, stops, height, shownCount: shown.length };
}

function StopLabel({
  text,
  color,
  side,
}: {
  text: string;
  color: string;
  side: LabelSide;
}) {
  return (
    <Text
      style={[styles.label, side === 'above' ? styles.labelAbove : styles.labelBelow, { color }]}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}

export function HuntJourney({
  theme,
  finds,
  onSelect,
  onHunt,
}: HuntJourneyProps) {
  const { width: screenW } = useWindowDimensions();
  const width = screenW;
  const trail = useMemo(() => composeTrail(finds, width), [finds, width]);
  const findCount = finds.length;
  const caption =
    findCount === 0
      ? 'Your trail starts here'
      : `${findCount} find${findCount === 1 ? '' : 's'}`;

  const stageH = trail.height + STAGE_EDGE * 2;

  return (
    <View style={styles.block}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.trailMark}
      >
        <Ionicons name="trail-sign-outline" size={22} color={theme.gold} />
        <Text style={[styles.trailMarkLabel, { color: theme.gold }]}>Trail Finds</Text>
      </View>

      <View style={styles.stage}>
        <TrailAtmosphere />

        <View style={[styles.wrap, { marginHorizontal: -SCREEN_PAD }]}>
          <ScrollView
            style={styles.trailScroll}
            contentContainerStyle={{ width }}
            horizontal={false}
            directionalLockEnabled
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            alwaysBounceHorizontal={false}
          >
            <View style={{ width, height: stageH }}>
              <Svg
                width={width}
                height={trail.height}
                style={[styles.svg, { top: STAGE_EDGE }]}
              >
                <Path
                  d={trail.d}
                  stroke={theme.gold}
                  strokeWidth={2}
                  strokeDasharray="7 11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={0.55}
                />
              </Svg>

              {trail.stops.map((stop, index) => {
                const size = NODE;
                const left = Math.min(Math.max(stop.x - STOP_W / 2, 0), width - STOP_W);
                const top = STAGE_EDGE + stop.y - size / 2;

                if (stop.kind === 'find') {
                  const lead = stop.find.colors[0]?.hex ?? theme.gold;
                  return (
                    <View key={stop.find.id} style={[styles.stop, { left, top, width: STOP_W }]}>
                      {stop.labelSide === 'above' ? (
                        <StopLabel text={stop.label} color={theme.muted} side="above" />
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open find ${stop.find.leafGuess ?? 'unnamed'}`}
                        onPress={() => onSelect?.(stop.find)}
                        style={[
                          styles.node,
                          {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            borderColor: lead,
                            shadowColor: lead,
                          },
                        ]}
                      >
                        <Image source={{ uri: stop.find.photoUri }} style={styles.thumb} />
                      </Pressable>
                      {stop.labelSide === 'below' ? (
                        <StopLabel text={stop.label} color={theme.muted} side="below" />
                      ) : null}
                    </View>
                  );
                }

                if (stop.kind === 'ghost') {
                  return (
                    <View key={`ghost-${stop.label}`} style={[styles.stop, { left, top, width: STOP_W }]}>
                      {stop.labelSide === 'above' ? (
                        <StopLabel text={stop.label} color={theme.muted} side="above" />
                      ) : null}
                      <View
                        style={[
                          styles.node,
                          styles.ghost,
                          {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            borderColor: theme.gold,
                          },
                        ]}
                      >
                        <Ionicons name="leaf-outline" size={20} color={theme.gold} />
                      </View>
                      {stop.labelSide === 'below' ? (
                        <StopLabel text={stop.label} color={theme.muted} side="below" />
                      ) : null}
                    </View>
                  );
                }

                return (
                  <View key={`pending-${index}`} style={[styles.stop, { left, top, width: STOP_W }]}>
                    {stop.labelSide === 'above' ? (
                      <StopLabel text="Next" color={theme.muted} side="above" />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Capture the next leaf"
                      onPress={onHunt}
                      style={[
                        styles.node,
                        styles.pending,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          borderColor: '#2D6A4F',
                        },
                      ]}
                    >
                      <Ionicons name="leaf" size={22} color="#2D6A4F" />
                      <Text style={[styles.pendingMark, { color: '#5A8F74' }]}>?</Text>
                    </Pressable>
                    {stop.labelSide === 'below' ? (
                      <StopLabel text="Next" color={theme.muted} side="below" />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.caption, { color: theme.muted }]}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    marginTop: 6,
    marginBottom: 4,
    overflow: 'visible',
  },
  trailMark: {
    position: 'absolute',
    top: 8,
    left: 6,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailMarkLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  stage: {
    flex: 1,
    minHeight: 0,
  },
  atmosphere: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  wrap: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'center',
    width: '100%',
  },
  trailScroll: {
    flex: 1,
  },
  svg: {
    position: 'absolute',
    left: 0,
  },
  stop: {
    position: 'absolute',
    alignItems: 'center',
    overflow: 'visible',
  },
  node: {
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A201CEE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  thumb: { width: '100%', height: '100%' },
  ghost: {
    backgroundColor: '#1A201CB0',
  },
  pending: {
    backgroundColor: '#0E1310',
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  pendingMark: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '800',
    bottom: 4,
    right: 7,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    width: '100%',
    textAlign: 'center',
  },
  labelAbove: {
    position: 'absolute',
    bottom: NODE + 6,
    left: 0,
    right: 0,
  },
  labelBelow: {
    marginTop: 6,
  },
  footer: {
    flexShrink: 0,
    marginTop: 10,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
