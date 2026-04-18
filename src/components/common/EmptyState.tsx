import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors } from '@/theme/colors';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon as React.ComponentProps<typeof Ionicons>['name']}
          size={56}
          color={colors.gray400}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
      {action ? (
        <View style={styles.actionContainer}>
          <Button
            title={action.label}
            onPress={action.onPress}
            variant="primary"
            size="md"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  actionContainer: {
    marginTop: 24,
  },
});
