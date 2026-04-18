import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

interface APExHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function APExHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}: APExHeaderProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top > 0 ? insets.top : Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

  return (
    <View style={[styles.container, { paddingTop }]}>
      <View style={styles.inner}>
        {/* Left side: back button or spacer */}
        <View style={styles.sideSlot}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.white} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center: title + subtitle */}
        <View style={styles.centerSlot}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right side: action or spacer */}
        <View style={styles.sideSlot}>
          {rightAction ?? null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
  },
  sideSlot: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backButton: {
    padding: 4,
    borderRadius: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 1,
  },
});
