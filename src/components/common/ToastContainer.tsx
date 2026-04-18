/**
 * ToastContainer.tsx
 * Global toast notification renderer. Mount once near the root of the app tree.
 *
 * Reads from uiStore, auto-dismisses toasts after their configured duration,
 * and animates each toast sliding in from the top of the screen.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore, type Toast } from '@/store/uiStore';
import { colors } from '@/theme/colors';

// ─── Single toast item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const TOAST_CONFIG: Record<
  Toast['type'],
  { bg: string; border: string; icon: string; iconColor: string; textColor: string }
> = {
  success: {
    bg: colors.successLight,
    border: colors.success,
    icon: 'checkmark-circle',
    iconColor: colors.success,
    textColor: '#065F46',
  },
  error: {
    bg: colors.dangerLight,
    border: colors.danger,
    icon: 'alert-circle',
    iconColor: colors.danger,
    textColor: '#991B1B',
  },
  warning: {
    bg: colors.warningLight,
    border: colors.warning,
    icon: 'warning',
    iconColor: colors.warning,
    textColor: '#92400E',
  },
  info: {
    bg: colors.infoLight,
    border: colors.info,
    icon: 'information-circle',
    iconColor: colors.info,
    textColor: '#1E40AF',
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[toast.type];

  // Slide in
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  }, [translateY, opacity, onDismiss, toast.id]);

  // Auto-dismiss
  useEffect(() => {
    const duration = toast.duration ?? 3500;
    if (duration === 0) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration]);

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: config.bg,
          borderLeftColor: config.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={config.icon as React.ComponentProps<typeof Ionicons>['name']}
        size={20}
        color={config.iconColor}
        style={styles.toastIcon}
      />
      <Text
        style={[styles.toastMessage, { color: config.textColor }]}
        numberOfLines={3}
      >
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityLabel="Dismiss notification"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={18} color={config.textColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

export function ToastContainer(): React.ReactElement | null {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  const topOffset = insets.top + (Platform.OS === 'android' ? 8 : 4);

  return (
    <View
      style={[styles.container, { top: topOffset }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  toastIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginRight: 8,
  },
});
