import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EvalStatus } from '@/types/evalFormLog';
import { colors } from '@/theme/colors';

interface StatusBadgeProps {
  status: EvalStatus;
  size?: 'sm' | 'md';
}

interface StatusConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<EvalStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    backgroundColor: colors.gray200,
    textColor: colors.gray700,
  },
  in_progress: {
    label: 'In Progress',
    backgroundColor: colors.infoLight,
    textColor: colors.info,
  },
  pending_review: {
    label: 'Pending Review',
    backgroundColor: colors.warningLight,
    textColor: colors.warning,
  },
  approved: {
    label: 'Approved',
    backgroundColor: colors.successLight,
    textColor: colors.success,
  },
  disputed: {
    label: 'Disputed',
    backgroundColor: colors.dangerLight,
    textColor: colors.danger,
  },
  complete: {
    label: 'Complete',
    backgroundColor: '#D1FAE5',
    textColor: '#065F46',
  },
  archived: {
    label: 'Archived',
    backgroundColor: colors.gray100,
    textColor: colors.gray500,
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps): React.ReactElement {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    backgroundColor: colors.gray200,
    textColor: colors.gray700,
  };

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: config.backgroundColor },
      ]}
    >
      <Text
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: config.textColor },
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textSm: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textMd: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
