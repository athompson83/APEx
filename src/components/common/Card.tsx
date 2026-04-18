import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  elevated = false,
  noPadding = false,
}: CardProps): React.ReactElement {
  const cardStyle = [
    styles.base,
    elevated ? styles.elevated : styles.normal,
    noPadding ? styles.noPadding : styles.withPadding,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  withPadding: {
    padding: 16,
  },
  noPadding: {
    padding: 0,
  },
  normal: {
    ...Platform.select({
      ios: {
        shadowColor: colors.gray900,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  elevated: {
    ...Platform.select({
      ios: {
        shadowColor: colors.gray900,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
    borderWidth: 0,
  },
});
