import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
}: ButtonProps): React.ReactElement {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${size}`],
    styles[`textVariant_${variant}`],
  ];

  const iconColor = variantIconColors[variant];
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  const spinnerColor = variant === 'primary' || variant === 'danger' ? colors.white : colors.primary;

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon as React.ComponentProps<typeof Ionicons>['name']}
              size={iconSize}
              color={iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text style={textStyle} numberOfLines={1}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon as React.ComponentProps<typeof Ionicons>['name']}
              size={iconSize}
              color={iconColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const variantIconColors: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: colors.white,
  secondary: colors.textPrimary,
  danger: colors.white,
  ghost: colors.primary,
  outline: colors.primary,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },

  // Sizes
  size_sm: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  size_md: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  size_lg: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.primary,
  },
  variant_secondary: {
    backgroundColor: colors.gray100,
  },
  variant_danger: {
    backgroundColor: colors.danger,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },

  // Text base
  text: {
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  text_sm: {
    fontSize: 13,
    lineHeight: 18,
  },
  text_md: {
    fontSize: 15,
    lineHeight: 20,
  },
  text_lg: {
    fontSize: 17,
    lineHeight: 22,
  },

  // Text colors per variant
  textVariant_primary: {
    color: colors.white,
  },
  textVariant_secondary: {
    color: colors.textPrimary,
  },
  textVariant_danger: {
    color: colors.white,
  },
  textVariant_ghost: {
    color: colors.primary,
  },
  textVariant_outline: {
    color: colors.primary,
  },
});
