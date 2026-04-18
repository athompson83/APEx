/**
 * CategoryCard.tsx
 * Expandable category card for eval scoring.
 * Collapsed: shows name, completion count, average score.
 * Expanded: renders each attribute as an AttributeScoreRow.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AttributeScoreRow } from './AttributeScoreRow';
import type { RenderedCategory } from '@/engines/evaluationRenderer';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: RenderedCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onScoreAttribute: (attributeId: string, score: number, notes?: string) => void;
  currentScores: Record<string, { score: number; notes?: string }>;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompletion(
  category: RenderedCategory,
  currentScores: Record<string, { score: number; notes?: string }>,
): { scored: number; total: number } {
  const scoreable = category.attributes.filter(
    (a) => !a.excludeFromScore && !a.isNotApplicable,
  );
  const total = scoreable.length;
  const scored = scoreable.filter(
    (a) => currentScores[a.id] !== undefined || a.currentScore !== undefined,
  ).length;
  return { scored, total };
}

function computeAverage(
  category: RenderedCategory,
  currentScores: Record<string, { score: number; notes?: string }>,
): number | undefined {
  const scoreable = category.attributes.filter(
    (a) => !a.excludeFromScore && !a.isNotApplicable,
  );
  if (scoreable.length === 0) return undefined;

  const values = scoreable
    .map((a) => currentScores[a.id]?.score ?? a.currentScore)
    .filter((v): v is number => v !== undefined);

  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryCard({
  category,
  isExpanded,
  onToggle,
  onScoreAttribute,
  currentScores,
  disabled = false,
}: CategoryCardProps): React.ReactElement {
  const animHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animHeight, {
        toValue: isExpanded ? 1 : 0,
        useNativeDriver: false,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded, animHeight, rotateAnim]);

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const { scored, total } = computeCompletion(category, currentScores);
  const allScored = total > 0 && scored === total;
  const average = computeAverage(category, currentScores);

  const handleScoreAttribute = useCallback(
    (attributeId: string, score: number, notes?: string) => {
      onScoreAttribute(attributeId, score, notes);
    },
    [onScoreAttribute],
  );

  return (
    <View style={styles.card}>
      {/* Header — always visible, tappable */}
      <TouchableOpacity
        style={[styles.header, isExpanded && styles.headerExpanded]}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${category.name} category, ${scored} of ${total} scored`}
        accessibilityState={{ expanded: isExpanded }}
      >
        {/* Completion check or progress indicator */}
        <View style={styles.completionIcon}>
          {allScored ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          ) : (
            <View style={styles.progressRing}>
              <Text style={styles.progressRingText}>{scored}</Text>
            </View>
          )}
        </View>

        {/* Category info */}
        <View style={styles.headerContent}>
          <Text style={styles.categoryName} numberOfLines={2}>
            {category.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.completionText}>
              {scored}/{total} scored
            </Text>
            {average !== undefined ? (
              <>
                <Text style={styles.metaDivider}> · </Text>
                <Text style={styles.averageText}>
                  Avg {average.toFixed(1)}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Chevron */}
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={20} color={colors.gray500} />
        </Animated.View>
      </TouchableOpacity>

      {/* Expandable body */}
      {isExpanded ? (
        <View style={styles.body}>
          {category.attributes.map((attribute, index) => {
            const existing = currentScores[attribute.id];
            const scoreValue = existing?.score ?? attribute.currentScore;
            const notesValue = existing?.notes ?? attribute.currentNotes ?? '';
            const scoreOption = attribute.scoreOptions.find(
              (o) => o.value === scoreValue,
            );
            const requiresFeedback =
              scoreOption?.requiresFeedback ?? attribute.commentsRequired;

            return (
              <AttributeScoreRow
                key={attribute.id}
                attribute={attribute}
                currentScore={scoreValue}
                currentNotes={notesValue}
                onScoreSelect={(score) =>
                  handleScoreAttribute(attribute.id, score, existing?.notes)
                }
                onNotesChange={(notes) => {
                  if (scoreValue !== undefined) {
                    handleScoreAttribute(attribute.id, scoreValue, notes);
                  }
                }}
                requiresFeedback={requiresFeedback}
                disabled={disabled}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  completionIcon: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
  },
  headerContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  metaDivider: {
    fontSize: 12,
    color: colors.gray400,
  },
  averageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  body: {
    // Attributes render directly, border handled per-row
  },
});
