/**
 * RequirementCard.tsx
 * Taskbook requirement card showing completion state, type badge, and actions.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import type { TaskbookItem } from '@/engines/taskbookEngine';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RequirementCardProps {
  item: TaskbookItem;
  onPress: () => void;
  onCheckOff?: () => void;
  canCheckOff?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  task: { label: 'Task', bg: colors.infoLight, text: colors.info },
  skill: { label: 'Skill', bg: '#EDE9FE', text: '#5B21B6' },
  assessment_form: { label: 'Assessment', bg: colors.warningLight, text: colors.warning },
  assessment_quiz: { label: 'Quiz', bg: '#ECFDF5', text: '#065F46' },
  assignment: { label: 'Assignment', bg: colors.gray100, text: colors.gray600 },
};

function formatDate(date?: Date): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isAssessmentType(type: string): boolean {
  return type === 'assessment_form' || type === 'assessment_quiz';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RequirementCard({
  item,
  onPress,
  onCheckOff,
  canCheckOff = false,
}: RequirementCardProps): React.ReactElement {
  const { requirement, requirementType, isComplete, isSignedOff, completedBy, completedAt, attemptCount, task } = item;
  const requiresCosign = task?.['Requires Cosign'] ?? false;
  const isDone = requiresCosign ? isSignedOff : isComplete;
  const cosignPending = isComplete && !isSignedOff && requiresCosign;
  const typeBadge = TYPE_BADGE_CONFIG[requirementType] ?? TYPE_BADGE_CONFIG['task'];
  const isAssessment = isAssessmentType(requirementType);

  return (
    <TouchableOpacity
      style={[styles.card, isDone && styles.cardComplete]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${requirement['Requirement Name']}, ${isDone ? 'complete' : 'incomplete'}`}
    >
      {/* Left: completion icon */}
      <View style={styles.iconCol}>
        {isDone ? (
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
        ) : cosignPending ? (
          <Ionicons name="time" size={26} color={colors.warning} />
        ) : (
          <Ionicons name="ellipse-outline" size={26} color={colors.gray400} />
        )}
      </View>

      {/* Center: content */}
      <View style={styles.content}>
        {/* Type badge row */}
        <View style={styles.badgeRow}>
          <Badge
            label={typeBadge.label}
            color={typeBadge.bg}
            textColor={typeBadge.text}
            size="sm"
          />
          {requiresCosign && (
            <Badge
              label="Needs Sign-Off"
              color={colors.warningLight}
              textColor={colors.warning}
              size="sm"
            />
          )}
          {requirement['Earns Points'] && requirement['Points'] ? (
            <Badge
              label={`${requirement['Points']} pts`}
              color={colors.gray100}
              textColor={colors.gray600}
              size="sm"
            />
          ) : null}
        </View>

        {/* Requirement name */}
        <Text
          style={[styles.name, isDone && styles.nameComplete]}
          numberOfLines={3}
        >
          {requirement['Requirement Name']}
        </Text>

        {/* Description */}
        {requirement.Description ? (
          <Text style={styles.description} numberOfLines={2}>
            {requirement.Description}
          </Text>
        ) : null}

        {/* Completion info */}
        {isDone && completedBy ? (
          <View style={styles.completedRow}>
            <Ionicons name="person-circle-outline" size={13} color={colors.success} />
            <Text style={styles.completedText}>
              {completedBy}
              {completedAt ? ` · ${formatDate(completedAt)}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Cosign pending state */}
        {cosignPending ? (
          <View style={styles.cosignRow}>
            <Ionicons name="hourglass-outline" size={13} color={colors.warning} />
            <Text style={styles.cosignText}>Awaiting evaluator sign-off</Text>
          </View>
        ) : null}

        {/* Attempt count */}
        {attemptCount > 0 && !isDone ? (
          <Text style={styles.attemptText}>
            {attemptCount} attempt{attemptCount !== 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {/* Right: action button */}
      <View style={styles.actionCol}>
        {isAssessment && !isDone ? (
          <Button
            title="Start"
            onPress={onPress}
            variant="outline"
            size="sm"
            icon="play-circle-outline"
            iconPosition="left"
          />
        ) : canCheckOff && !isDone && onCheckOff ? (
          <Button
            title="Sign Off"
            onPress={onCheckOff}
            variant="primary"
            size="sm"
            icon="checkmark"
            iconPosition="left"
          />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 10,
  },
  cardComplete: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  iconCol: {
    paddingTop: 2,
    width: 28,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  nameComplete: {
    color: colors.gray600,
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 17,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.success,
  },
  cosignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cosignText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.warning,
  },
  attemptText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
    minWidth: 36,
  },
});
