/**
 * ScoreButton.tsx
 * Score selection button — the core UI atom of the eval scoring experience.
 *
 * Large touch targets suitable for field use (min 56w × 64h).
 * Selection is animated with a brief scale pulse.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScoreOption } from '@/engines/evaluationRenderer';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScoreButtonProps {
  scoreOption: ScoreOption;
  isSelected: boolean;
  onPress: (value: number) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScoreButton({
  scoreOption,
  isSelected,
  onPress,
  disabled = false,
}: ScoreButtonProps): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  // Pulse animation on selection
  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }),
      ]).start();
    }
  }, [isSelected, scale]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress(scoreOption.value);
    }
  }, [disabled, onPress, scoreOption.value]);

  const selectedBg = scoreOption.color || colors.primary;

  return (
    <Animated.View style={[styles.animWrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[
          styles.button,
          isSelected
            ? [styles.buttonSelected, { backgroundColor: selectedBg, borderColor: selectedBg }]
            : styles.buttonUnselected,
          disabled && styles.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityLabel={`Score ${scoreOption.value}: ${scoreOption.label}`}
        accessibilityState={{ selected: isSelected, disabled }}
      >
        {/* Score value — prominent */}
        <Text
          style={[
            styles.valueText,
            isSelected ? styles.valueTextSelected : styles.valueTextUnselected,
          ]}
        >
          {scoreOption.value}
        </Text>

        {/* Label — smaller, below the value */}
        <Text
          style={[
            styles.labelText,
            isSelected ? styles.labelTextSelected : styles.labelTextUnselected,
          ]}
          numberOfLines={2}
        >
          {scoreOption.label}
        </Text>

        {/* Checkmark overlay when selected */}
        {isSelected ? (
          <Ionicons
            name="checkmark-circle"
            size={14}
            color="rgba(255,255,255,0.9)"
            style={styles.checkmark}
          />
        ) : null}

        {/* Feedback required indicator */}
        {scoreOption.requiresFeedback && !isSelected ? (
          <Ionicons
            name="create-outline"
            size={12}
            color={colors.gray400}
            style={styles.feedbackIndicator}
          />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  animWrapper: {
    // Flex child in a Row
  },
  button: {
    minWidth: 56,
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    // backgroundColor and borderColor set inline from scoreOption.color
  },
  buttonUnselected: {
    backgroundColor: colors.white,
    borderColor: colors.gray300,
  },
  disabled: {
    opacity: 0.45,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  valueTextSelected: {
    color: colors.white,
  },
  valueTextUnselected: {
    color: colors.gray500,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  labelTextSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  labelTextUnselected: {
    color: colors.gray500,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  feedbackIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
