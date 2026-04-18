/**
 * EvalCard.tsx
 * Evaluation card for lists and dashboards. Renders a BubbleEvalFormLog
 * with key metadata, status badge, and an optional "needs action" highlight.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/common/Badge';
import type { BubbleEvalFormLog } from '@/types/evalFormLog';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EvalCardProps {
  formLog: BubbleEvalFormLog;
  onPress: () => void;
  /** Show the subject user id / name row */
  showSubject?: boolean;
  /** Show the evaluator user id / name row */
  showEvaluator?: boolean;
  /** Orange left accent border for items that need action */
  highlight?: boolean;
  /** Optional resolved display names (to avoid prop drilling IDs) */
  subjectName?: string;
  evaluatorName?: string;
  evalFormName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Determines the eval type label from the form log fields.
 * Shift evals have a Related Shift, call evals have a Call Reference.
 */
function getEvalTypeBadge(log: BubbleEvalFormLog): {
  label: string;
  bg: string;
  text: string;
} {
  if (log['Related Shift']) {
    return { label: 'Shift', bg: colors.infoLight, text: colors.info };
  }
  if (log['Call Reference']) {
    return { label: 'Call', bg: '#EDE9FE', text: '#5B21B6' };
  }
  return { label: 'Standard', bg: colors.gray100, text: colors.gray700 };
}

function getWorkflowStepLabel(log: BubbleEvalFormLog): string {
  if (!log['Current Workflow Step']) return '';
  return 'Awaiting Review';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EvalCard({
  formLog,
  onPress,
  showSubject = true,
  showEvaluator = false,
  highlight = false,
  subjectName,
  evaluatorName,
  evalFormName,
}: EvalCardProps): React.ReactElement {
  const typeBadge = getEvalTypeBadge(formLog);
  const workflowLabel = getWorkflowStepLabel(formLog);
  const dateLabel = formatDate(formLog['Started At'] ?? formLog.created_date);
  const hasParent = !!formLog['Program Roster'];
  const hasChild = !!formLog['Phase Requirement'];

  return (
    <View style={[styles.wrapper, highlight && styles.wrapperHighlight]}>
      {highlight && <View style={styles.highlightAccent} />}
      <Card onPress={onPress} noPadding style={styles.card}>
        {/* Header row: type badge + date + status */}
        <View style={styles.headerRow}>
          <Badge
            label={typeBadge.label}
            color={typeBadge.bg}
            textColor={typeBadge.text}
            size="sm"
          />
          <Text style={styles.dateText}>{dateLabel}</Text>
          <StatusBadge status={formLog.Status} size="sm" />
        </View>

        {/* Form name */}
        {evalFormName ? (
          <Text style={styles.formName} numberOfLines={2}>
            {evalFormName}
          </Text>
        ) : null}

        {/* Subject / Evaluator rows */}
        {showSubject && (
          <View style={styles.personRow}>
            <Ionicons name="person" size={14} color={colors.textSecondary} style={styles.personIcon} />
            <Text style={styles.personLabel}>Subject: </Text>
            <Text style={styles.personName} numberOfLines={1}>
              {subjectName ?? formLog.Subject ?? 'Unknown'}
            </Text>
          </View>
        )}
        {showEvaluator && (
          <View style={styles.personRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} style={styles.personIcon} />
            <Text style={styles.personLabel}>Evaluator: </Text>
            <Text style={styles.personName} numberOfLines={1}>
              {evaluatorName ?? formLog.Evaluator ?? 'Unknown'}
            </Text>
          </View>
        )}

        {/* Footer row: workflow step + parent/child indicators */}
        {(workflowLabel || hasParent || hasChild) ? (
          <View style={styles.footerRow}>
            {workflowLabel ? (
              <View style={styles.workflowChip}>
                <Ionicons name="git-branch" size={12} color={colors.primary} />
                <Text style={styles.workflowText}>{workflowLabel}</Text>
              </View>
            ) : null}
            {hasParent && (
              <View style={styles.relationChip}>
                <Ionicons name="layers" size={12} color={colors.accent} />
                <Text style={styles.relationText}>Program</Text>
              </View>
            )}
            {hasChild && (
              <View style={styles.relationChip}>
                <Ionicons name="checkmark-done" size={12} color={colors.success} />
                <Text style={styles.relationText}>Phase Req</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Average score pill if available */}
        {formLog['Average Score'] !== undefined && formLog['Average Score'] !== null ? (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Avg Score</Text>
            <View style={styles.scorePill}>
              <Text style={styles.scoreValue}>
                {formLog['Average Score'].toFixed(1)}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  wrapperHighlight: {
    // The accent is positioned absolutely, card shifts right via paddingLeft below
  },
  highlightAccent: {
    width: 4,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  formName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  personIcon: {
    marginRight: 4,
  },
  personLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  personName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  workflowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  workflowText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  relationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gray100,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  relationText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  scorePill: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
