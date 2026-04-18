import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/theme/colors';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void };
  count?: number;
}

export function SectionHeader({
  title,
  subtitle,
  rightAction,
  count,
}: SectionHeaderProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {count !== undefined && count !== null ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {rightAction ? (
        <TouchableOpacity
          onPress={rightAction.onPress}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={rightAction.label}
        >
          <Text style={styles.rightActionLabel}>{rightAction.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  left: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  countBadge: {
    backgroundColor: colors.gray200,
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rightActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
