/**
 * ErrorBoundary.tsx
 * React class-based error boundary that catches render-phase errors
 * and displays a recoverable fallback UI.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

// ─── Props / State ────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback rendered instead of the default UI. */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** Optional label shown above the error (e.g. screen name) */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    // In production you would send to Sentry / Datadog here.
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, context } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Custom fallback takes precedence
    if (fallback) {
      return fallback(error, this.handleRetry);
    }

    return (
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={56} color={colors.danger} />
        </View>

        <Text style={styles.title}>Something went wrong</Text>

        {context ? (
          <Text style={styles.context}>{context}</Text>
        ) : null}

        <Text style={styles.message}>
          An unexpected error occurred. Please try again. If the problem
          persists, restart the app or contact support.
        </Text>

        {__DEV__ ? (
          <View style={styles.devBlock}>
            <Text style={styles.devLabel}>Error (dev only)</Text>
            <Text style={styles.devText} selectable>
              {error.toString()}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.retryButton}
          onPress={this.handleRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Ionicons name="refresh" size={18} color={colors.white} style={styles.retryIcon} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  context: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  devBlock: {
    width: '100%',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  devText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.gray700,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: 0.25,
  },
});
