import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GuideTurn } from '@/domain/guide';
import { lookupSpeciesTraits } from '@/domain/speciesTraits';
import { GlassPanel } from '@/presentation/components/GlassPanel';
import type { FallTheme } from '@/presentation/theme';

interface LeafFindCardProps {
  theme: FallTheme;
  turn: GuideTurn;
}

/**
 * Find result on glass — Identification (name + guide) then Details (curated note).
 */
export function LeafFindCard({ theme, turn }: LeafFindCardProps) {
  const colors = turn.colors?.slice(0, 4) ?? [];
  const traits = turn.traits ?? lookupSpeciesTraits(turn.leafGuess);
  const name = turn.leafGuess ?? 'unnamed leaf';

  return (
    <GlassPanel theme={theme} intensity={48} style={styles.card}>
      <View style={styles.section}>
        <Text style={[styles.kicker, { color: theme.gold }]}>Identification</Text>
        <Text style={[styles.title, { color: theme.text }]}>{name}</Text>

        {colors.length > 0 ? (
          <View style={styles.swatches}>
            {colors.map((c) => (
              <View key={`${c.name}-${c.hex}`} style={styles.swatch}>
                <View
                  style={[
                    styles.swatchDot,
                    { backgroundColor: c.hex, borderColor: theme.glassBorder },
                  ]}
                />
                <Text style={[styles.swatchName, { color: theme.muted }]}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {turn.reply ? (
          <Text style={[styles.blurb, { color: theme.muted }]} numberOfLines={5}>
            {turn.reply}
          </Text>
        ) : null}
      </View>

      {traits ? (
        <View style={[styles.section, styles.detailsSection, { borderTopColor: theme.glassBorder }]}>
          <Text style={[styles.kicker, { color: theme.gold }]}>Details</Text>
          <Text style={[styles.detailNote, { color: theme.text }]}>{traits.note}</Text>
        </View>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 16,
  },
  section: {
    gap: 6,
  },
  detailsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  swatch: { alignItems: 'center', gap: 4, minWidth: 56 },
  swatchDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  swatchName: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  blurb: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  detailNote: {
    fontSize: 15,
    lineHeight: 21,
  },
});
