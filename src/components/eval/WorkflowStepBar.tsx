/**
 * WorkflowStepBar.tsx
 * Visual workflow progress indicator showing step dots connected by lines.
 * Current step pulses, completed steps are filled green, future are hollow.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BubbleFormWorkflowStep } from '@/types/workflow';
import type { BubbleEvalFormLog } from '@/types/evalFormLog';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkflowStepBarProps {
  steps: BubbleFormWorkflowStep[];
  currentStepId: string;
  formLog: BubbleEvalFormLog;
}

// ─── Step dot ─────────────────────────────────────────────────────────────────

interface StepDotProps {
  step: BubbleFormWorkflowStep;
  state: 'complete' | 'active' | 'pending';
  isLast: boolean;
}

function StepDot({ step, state, isLast }: StepDotProps): React.ReactElement {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'active') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [state, pulseAnim]);

  const dotBg =
    state === 'complete'
      ? colors.success
      : state === 'active'
      ? colors.primary
      : colors.gray300;

  const lineBg = state === 'complete' ? colors.success : colors.gray200;

  return (
    <View style={styles.stepDotWrapper}>
      {/* Dot with optional pulse halo for active step */}
      <View style={styles.dotContainer}>
        {state === 'active' ? (
          <Animated.View
            style={[
              styles.pulseDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
        ) : null}
        <View style={[styles.dot, { backgroundColor: dotBg }]}>
          {state === 'complete' ? (
            <Ionicons name="checkmark" size={12} color={colors.white} />
          ) : state === 'active' ? (
            <View style={styles.activeDotInner} />
          ) : null}
        </View>
      </View>

      {/* Step label */}
      <Text
        style={[
          styles.stepLabel,
          state === 'active' && styles.stepLabelActive,
          state === 'complete' && styles.stepLabelComplete,
        ]}
        numberOfLines={2}
      >
        {step['Step Name']}
      </Text>

      {/* Connector line */}
      {!isLast ? (
        <View style={[styles.connector, { backgroundColor: lineBg }]} />
      ) : null}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkflowStepBar({
  steps,
  currentStepId,
  formLog,
}: WorkflowStepBarProps): React.ReactElement {
  // Sort steps by rank
  const sortedSteps = [...steps].sort((a, b) => a.Rank - b.Rank);

  const currentIndex = sortedSteps.findIndex((s) => s._id === currentStepId);
  const currentStep = sortedSteps[currentIndex];
  const stepCount = sortedSteps.length;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : stepCount;

  // Determine who needs to act
  function getActorDescription(step: BubbleFormWorkflowStep): string {
    if (step['Subject Must Action']) return 'Subject must acknowledge';
    if (step['Evaluator Must Action']) return 'Evaluator must confirm';
    const roles = step['Reviewer Roles'];
    if (roles && roles.length > 0) {
      const labels: Record<string, string> = {
        admin: 'Admin',
        evaluator: 'Evaluator',
        reviewer: 'Reviewer',
        subject: 'Subject',
      };
      return `Awaiting ${roles.map((r) => labels[r] ?? r).join(' or ')}`;
    }
    return 'Awaiting review';
  }

  function getStepState(step: BubbleFormWorkflowStep, index: number): 'complete' | 'active' | 'pending' {
    if (index < currentIndex) return 'complete';
    if (step._id === currentStepId) return 'active';
    return 'pending';
  }

  return (
    <View style={styles.container}>
      {/* Step counter label */}
      <Text style={styles.counterLabel}>
        {currentIndex >= 0
          ? `Step ${displayIndex} of ${stepCount}`
          : `${stepCount} steps complete`}
      </Text>

      {/* Step dots row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dotsScrollContent}
        scrollEnabled={stepCount > 4}
      >
        {sortedSteps.map((step, index) => (
          <StepDot
            key={step._id}
            step={step}
            state={getStepState(step, index)}
            isLast={index === stepCount - 1}
          />
        ))}
      </ScrollView>

      {/* Current step detail */}
      {currentStep ? (
        <View style={styles.currentStepDetail}>
          <Text style={styles.currentStepName}>{currentStep['Step Name']}</Text>
          <Text style={styles.currentStepActor}>
            {getActorDescription(currentStep)}
          </Text>
          {currentStep.Instructions ? (
            <Text style={styles.currentStepInstructions} numberOfLines={3}>
              {currentStep.Instructions}
            </Text>
          ) : null}
        </View>
      ) : formLog.Status === 'approved' || formLog.Status === 'complete' ? (
        <View style={styles.currentStepDetail}>
          <View style={styles.completeRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.completeText}>
              {formLog.Status === 'complete' ? 'Evaluation complete' : 'Approved'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  dotsScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  stepDotWrapper: {
    alignItems: 'center',
    width: 64,
    position: 'relative',
  },
  dotContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pulseDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(27, 58, 107, 0.2)',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  activeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.gray400,
    textAlign: 'center',
    lineHeight: 13,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepLabelComplete: {
    color: colors.success,
  },
  connector: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: 42,
    height: 2,
    borderRadius: 1,
    // Shift connector to start after dot center
    marginLeft: 11,
  },
  currentStepDetail: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  currentStepName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  currentStepActor: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 4,
  },
  currentStepInstructions: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});
