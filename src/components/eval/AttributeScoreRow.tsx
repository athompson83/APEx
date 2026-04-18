/**
 * AttributeScoreRow.tsx
 * Individual attribute scoring row within a category.
 * Renders score buttons, optional notes (required when score demands feedback).
 */

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreButton } from './ScoreButton';
import { FeedbackInput } from './FeedbackInput';
import type { RenderedAttribute } from '@/engines/evaluationRenderer';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttributeScoreRowProps {
  attribute: RenderedAttribute;
  currentScore?: number;
  currentNotes?: string;
  onScoreSelect: (score: number) => void;
  onNotesChange: (notes: string) => void;
  requiresFeedback: boolean;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttributeScoreRow({
  attribute,
  currentScore,
  currentNotes = '',
  onScoreSelect,
  onNotesChange,
  requiresFeedback,
  disabled = false,
}: AttributeScoreRowProps): React.ReactElement {
  // Optional notes section collapsed by default (only relevant when feedback not required)
  const [optionalNotesExpanded, setOptionalNotesExpanded] = useState(
    currentNotes.length > 0,
  );

  const isScored = currentScore !== undefined;
  const showRequiredFeedback = isScored && requiresFeedback;
  const showOptionalFeedbackToggle = isScored && !requiresFeedback;
  const showOptionalFeedback = showOptionalFeedbackToggle && optionalNotesExpanded;

  const handleToggleOptionalNotes = useCallback(() => {
    setOptionalNotesExpanded((prev) => !prev);
  }, []);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* Attribute name + description */}
      <View style={styles.headerBlock}>
        <View style={styles.nameRow}>
          {attribute.isNotApplicable ? (
            <View style={styles.naBadge}>
              <Text style={styles.naText}>N/A</Text>
            </View>
          ) : null}
          <Text
            style={[
              styles.attributeName,
              attribute.isNotApplicable && styles.attributeNameNA,
            ]}
            numberOfLines={3}
          >
            {attribute.name}
          </Text>
          {attribute.excludeFromScore ? (
            <View style={styles.excludedBadge}>
              <Text style={styles.excludedText}>Not Scored</Text>
            </View>
          ) : null}
        </View>
        {attribute.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {attribute.description}
          </Text>
        ) : null}
      </View>

      {/* Score buttons */}
      <View style={styles.scoreButtonsRow}>
        {attribute.scoreOptions.map((option) => (
          <ScoreButton
            key={option.value}
            scoreOption={option}
            isSelected={currentScore === option.value}
            onPress={onScoreSelect}
            disabled={disabled || attribute.isNotApplicable}
          />
        ))}
      </View>

      {/* Required feedback area */}
      {showRequiredFeedback ? (
        <View style={styles.feedbackContainer}>
          <FeedbackInput
            label="Feedback"
            value={currentNotes}
            onChange={onNotesChange}
            required={requiresFeedback}
            placeholder="Explain this score…"
            maxLength={500}
            disabled={disabled}
          />
        </View>
      ) : null}

      {/* Optional notes toggle + area */}
      {showOptionalFeedbackToggle ? (
        <>
          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={handleToggleOptionalNotes}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              optionalNotesExpanded ? 'Hide optional notes' : 'Add optional notes'
            }
          >
            <Ionicons
              name={optionalNotesExpanded ? 'chevron-up' : 'create-outline'}
              size={14}
              color={colors.primary}
            />
            <Text style={styles.optionalToggleText}>
              {optionalNotesExpanded ? 'Hide notes' : 'Add notes (optional)'}
            </Text>
          </TouchableOpacity>

          {showOptionalFeedback ? (
            <View style={styles.feedbackContainer}>
              <FeedbackInput
                value={currentNotes}
                onChange={onNotesChange}
                required={false}
                placeholder="Optional notes…"
                maxLength={500}
                disabled={disabled}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  containerDisabled: {
    opacity: 0.65,
  },
  headerBlock: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  attributeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  attributeNameNA: {
    color: colors.gray400,
    textDecorationLine: 'line-through',
  },
  naBadge: {
    backgroundColor: colors.gray200,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  naText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
  },
  excludedBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  excludedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 17,
  },
  scoreButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  feedbackContainer: {
    marginTop: 10,
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  optionalToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
});
