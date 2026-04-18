/**
 * FeedbackInput.tsx
 * Multiline text input for evaluator feedback and notes.
 * Large touch target, character count when maxLength set.
 */

import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeedbackInputProps {
  value: string;
  onChange: (text: string) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackInput({
  value,
  onChange,
  required = false,
  placeholder = 'Add feedback or notes…',
  maxLength,
  label,
  disabled = false,
}: FeedbackInputProps): React.ReactElement {
  const inputRef = useRef<TextInput>(null);

  const charCount = value.length;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;
  const isAtLimit = maxLength !== undefined && charCount >= maxLength * 0.9;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      accessible={false}
    >
      <View style={styles.container}>
        {label ? (
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
          </View>
        ) : null}

        <View
          style={[
            styles.inputWrapper,
            disabled && styles.inputWrapperDisabled,
            isOverLimit && styles.inputWrapperError,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, disabled && styles.inputDisabled]}
            value={value}
            onChangeText={onChange}
            placeholder={required ? `${placeholder} (required)` : placeholder}
            placeholderTextColor={colors.gray400}
            multiline
            numberOfLines={4}
            maxLength={maxLength ? maxLength + 20 : undefined} // soft limit in UI, hard limit via isOverLimit
            editable={!disabled}
            textAlignVertical="top"
            scrollEnabled={false}
            returnKeyType="default"
            blurOnSubmit={false}
            accessibilityLabel={label ?? 'Feedback notes'}
            accessibilityHint={required ? 'Required field' : 'Optional notes'}
          />

          {maxLength !== undefined ? (
            <Text
              style={[
                styles.charCount,
                isAtLimit && styles.charCountWarning,
                isOverLimit && styles.charCountError,
              ]}
            >
              {charCount}/{maxLength}
            </Text>
          ) : null}
        </View>

        {required && value.trim().length === 0 ? (
          <Text style={styles.requiredHint}>Feedback is required for this score.</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  requiredAsterisk: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    minHeight: 80,
  },
  inputWrapperDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },
  input: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textPrimary,
    lineHeight: 21,
    minHeight: 60,
    paddingTop: 0,
    paddingBottom: 0,
  },
  inputDisabled: {
    color: colors.textSecondary,
  },
  charCount: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 4,
  },
  charCountWarning: {
    color: colors.warning,
  },
  charCountError: {
    color: colors.danger,
    fontWeight: '700',
  },
  requiredHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.danger,
    marginTop: 4,
  },
});
