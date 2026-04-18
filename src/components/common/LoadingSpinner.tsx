import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface FullScreenLoaderProps {
  message?: string;
}

export function FullScreenLoader({ message }: FullScreenLoaderProps): React.ReactElement {
  return (
    <View style={styles.fullScreenContainer}>
      <View style={styles.brandingContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>A</Text>
        </View>
        <Text style={styles.brandName}>APEx360</Text>
      </View>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
    </View>
  );
}

interface InlineLoaderProps {
  size?: 'small' | 'large';
  color?: string;
}

export function InlineLoader({
  size = 'small',
  color = colors.primary,
}: InlineLoaderProps): React.ReactElement {
  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});
