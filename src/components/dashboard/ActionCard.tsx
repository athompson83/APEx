/**
 * ActionCard.tsx
 * "Needs Action" dashboard card with strong visual hierarchy.
 * High urgency items get an orange left border accent.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import type { BubbleEvalFormLog } from '@/types/evalFormLog';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActionCardProps {
  formLog: BubbleEvalFormLog;
  actionLabel: string;
  onPress: () => void;
  urgency?: 'normal' | 'high';
  subjectName?: string;
  evaluatorName?: string;
  evalFormName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const STATUS_ACTION_ICON: Partial<Record<string, string>> = {
  draft: 'create-outline',
  in_progress: 'pencil',
  pending_review: 'eye-outline',
  disputed: 'alert-circle-outline',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionCard({
  formLog,
  actionLabel,
  onPress,
  urgency = 'normal',
  subjectName,
  evaluatorName,
  evalFormName,
}: ActionCardProps): React.ReactElement {
  const isHighUrgency = urgency === 'high';
  const actionIcon = STATUS_ACTION_ICON[formLog.Status] ?? 'arrow-forward-circle';
  const dateStr = formatDate(formLog['Started At'] ?? formLog.created_date);

  return (
    <TouchableOpacity
      style={[styles.cardWrapper, isHighUrgency && styles.cardWrapperHigh]}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel}: ${evalFormName ?? 'Evaluation'}`}
    >
      {/* Left urgency accent */}
      {isHighUrgency ? <View style={styles.accentBar} /> : null}

      <View style={[styles.inner, isHighUrgency && styles.innerHigh]}>
        {/* Top row: urgency indicator + form name + status */}
        <View style={styles.topRow}>
          {isHighUrgency ? (
            <Ionicons name="alert-circle" size={16} color={colors.accent} style={styles.urgencyIcon} />
          ) : null}
          <Text style={styles.formName} numberOfLines={2}>
            {evalFormName ?? 'Evaluation'}
          </Text>
          <StatusBadge status={formLog.Status} size="sm" />
        </View>

        {/* Action label — prominently displayed */}
        <View style={styles.actionLabelRow}>
          <Ionicons
            name={actionIcon as React.ComponentProps<typeof Ionicons>['name']}
            size={15}
            color={isHighUrgency ? colors.accent : colors.primary}
          />
          <Text
            style={[
              styles.actionLabel,
              isHighUrgency && styles.actionLabelHigh,
            ]}
          >
            {actionLabel}
          </Text>
        </View>

        {/* Meta info */}
        <View style={styles.metaRow}>
          {subjectName ? (
            <View style={styles.metaChip}>
              <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{subjectName}</Text>
            </View>
          ) : null}
          {evaluatorName ? (
            <View style={styles.metaChip}>
              <Ionicons name="shield-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{evaluatorName}</Text>
            </View>
          ) : null}
          {dateStr ? (
            <View style={styles.metaChip}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
          ) : null}
        </View>

        {/* CTA button */}
        <View style={styles.buttonRow}>
          <Button
            title={actionLabel}
            onPress={onPress}
            variant={isHighUrgency ? 'primary' : 'outline'}
            size="sm"
            icon="arrow-forward"
            iconPosition="right"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  cardWrapperHigh: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  accentBar: {
    width: 4,
    backgroundColor: colors.accent,
  },
  inner: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  innerHigh: {
    // Slightly more prominent background for high urgency
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  urgencyIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  formName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  actionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.1,
  },
  actionLabelHigh: {
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 160,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  buttonRow: {
    alignItems: 'flex-start',
    marginTop: 2,
  },
});
