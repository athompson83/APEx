/**
 * TaskCheckoffRow.tsx
 * Quick task sign-off UI for evaluators.
 * Checkbox style: shows task name, completion info, or "Sign Off" button.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import type { BubbleTask } from '@/types/taskbook';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskCheckoffRowProps {
  task: BubbleTask;
  isComplete: boolean;
  onCheckOff: () => void;
  completedBy?: string;
  completedAt?: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date?: Date): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskCheckoffRow({
  task,
  isComplete,
  onCheckOff,
  completedBy,
  completedAt,
}: TaskCheckoffRowProps): React.ReactElement {
  return (
    <View style={[styles.row, isComplete && styles.rowComplete]}>
      {/* Checkbox icon */}
      <View style={styles.checkboxCol}>
        {isComplete ? (
          <View style={styles.checkboxChecked}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.checkboxUnchecked}
            onPress={onCheckOff}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel={`Check off ${task['Task Name']}`}
            accessibilityState={{ checked: false }}
          />
        )}
      </View>

      {/* Task content */}
      <View style={styles.content}>
        <Text
          style={[styles.taskName, isComplete && styles.taskNameComplete]}
          numberOfLines={2}
        >
          {task['Task Name']}
        </Text>

        {/* Skill badge */}
        {task['Is Skill'] ? (
          <View style={styles.skillBadge}>
            <Text style={styles.skillBadgeText}>Skill</Text>
          </View>
        ) : null}

        {/* Completion info */}
        {isComplete && (completedBy || completedAt) ? (
          <View style={styles.completionInfo}>
            <Ionicons
              name="checkmark-circle-outline"
              size={12}
              color={colors.success}
            />
            <Text style={styles.completionText}>
              {[completedBy, completedAt ? formatDate(completedAt) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {/* Cosign required indicator */}
        {task['Requires Cosign'] && !isComplete ? (
          <Text style={styles.cosignHint}>Requires evaluator sign-off</Text>
        ) : null}
      </View>

      {/* Action button — only when not complete */}
      {!isComplete ? (
        <View style={styles.actionCol}>
          <Button
            title="Sign Off"
            onPress={onCheckOff}
            variant="primary"
            size="sm"
            icon="checkmark"
            iconPosition="left"
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: 10,
    backgroundColor: colors.white,
  },
  rowComplete: {
    backgroundColor: '#F0FDF4',
  },
  checkboxCol: {
    paddingTop: 1,
    width: 24,
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  taskName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  taskNameComplete: {
    color: colors.gray500,
  },
  skillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B21B6',
  },
  completionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.success,
  },
  cosignHint: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionCol: {
    paddingTop: 1,
    justifyContent: 'flex-start',
  },
});
