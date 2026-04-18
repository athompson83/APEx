import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  label,
  color = colors.gray200,
  textColor = colors.textPrimary,
  size = 'md',
  dot = false,
}: BadgeProps): React.ReactElement {
  if (dot) {
    return (
      <View style={styles.dotContainer}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text
          style={[
            size === 'sm' ? styles.labelSm : styles.labelMd,
            { color: textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: color },
      ]}
    >
      <Text
        style={[
          size === 'sm' ? styles.labelSm : styles.labelMd,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {label}
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
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  labelSm: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
