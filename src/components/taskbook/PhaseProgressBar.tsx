/**
 * PhaseProgressBar.tsx
 * Animated progress bar for a training phase showing completion percentage.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BubbleProgramPhase } from '@/types/roster';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhaseProgressBarProps {
  phase: BubbleProgramPhase;
  completedCount: number;
  totalCount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhaseProgressBar({
  phase,
  completedCount,
  totalCount,
}: PhaseProgressBarProps): React.ReactElement {
  const percentage = totalCount === 0 ? 100 : Math.round((completedCount / totalCount) * 100);
  const isComplete = percentage === 100;

  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [percentage, widthAnim]);

  const fillWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.phaseLabel}>Phase {phase.Rank}</Text>
          <Text style={styles.phaseName} numberOfLines={2}>
            {phase['Phase Name']}
          </Text>
        </View>
        <View style={styles.rightBlock}>
          {isComplete ? (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.completeBadgeText}>Complete</Text>
            </View>
          ) : (
            <Text style={styles.percentageText}>{percentage}%</Text>
          )}
        </View>
      </View>

      {/* Progress bar track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              backgroundColor: isComplete ? colors.success : colors.primary,
            },
          ]}
        />
      </View>

      {/* Count label */}
      <Text style={styles.countLabel}>
        {completedCount} of {totalCount} requirement{totalCount !== 1 ? 's' : ''} complete
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  labelGroup: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  phaseName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  rightBlock: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  percentageText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  track: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
