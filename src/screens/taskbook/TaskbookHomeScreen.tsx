/**
 * TaskbookHomeScreen.tsx
 * Subject's taskbook view and evaluator subject-roster view.
 *
 * - Subjects see their own program, phase, and all phase requirements.
 * - Evaluators navigating here via a rosterId param see that subject's taskbook.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { PhaseProgressBar } from '@/components/taskbook/PhaseProgressBar';
import { RequirementCard } from '@/components/taskbook/RequirementCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useTaskbook } from '@/hooks/useTaskbook';
import { useAudit } from '@/hooks/useAudit';
import { TaskRequirementType } from '@/types/taskbook';
import type { TaskbookHomeScreenProps } from '@/navigation/types';
import type { TaskbookItem } from '@/engines/taskbookEngine';

type GroupedRequirements = Record<TaskRequirementType, TaskbookItem[]>;

function groupByType(items: TaskbookItem[]): GroupedRequirements {
  const groups: GroupedRequirements = {
    task: [],
    skill: [],
    assessment_form: [],
    assessment_quiz: [],
    assignment: [],
  };
  for (const item of items) {
    groups[item.requirementType].push(item);
  }
  return groups;
}

const TYPE_LABELS: Record<TaskRequirementType, string> = {
  task: 'Tasks',
  skill: 'Skills',
  assessment_form: 'Form Assessments',
  assessment_quiz: 'Quizzes',
  assignment: 'Assignments',
};

export default function TaskbookHomeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<TaskbookHomeScreenProps['route']>();
  const paramRosterId = (route.params as any)?.rosterId as string | undefined;

  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const { logTaskCheckedOff } = useAudit();

  const {
    roster,
    currentPhase,
    taskbookState,
    isLoading,
    refetch,
    markTaskComplete,
    canCheckOff,
  } = useTaskbook(paramRosterId);

  const handleRequirementPress = useCallback(
    (item: TaskbookItem) => {
      if (!roster) return;
      if (item.requirementType === 'assessment_quiz') {
        const quizId = (item.assessment as any)?.Quiz;
        if (quizId) {
          navigation.navigate('Quiz' as never, {
            quizId,
            requirementId: item.requirement._id,
            rosterId: roster._id,
          } as never);
        }
        return;
      }
      if (item.requirementType === 'assessment_form') {
        const assessmentId = item.assessment?._id;
        if (assessmentId) {
          navigation.navigate('Assessment' as never, {
            assessmentId,
            requirementId: item.requirement._id,
            rosterId: roster._id,
          } as never);
        }
        return;
      }
      navigation.navigate('RequirementDetail' as never, {
        requirementId: item.requirement._id,
        rosterId: roster?._id ?? '',
      } as never);
    },
    [navigation, roster],
  );

  const handleCheckOff = useCallback(
    async (item: TaskbookItem) => {
      if (!user || !roster) return;
      try {
        await markTaskComplete(item);
        await logTaskCheckedOff(item.requirement._id, roster._id);
        addToast('Task signed off', 'success');
      } catch {
        addToast('Failed to sign off task', 'error');
      }
    },
    [user, roster, markTaskComplete, logTaskCheckedOff, addToast],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!roster || !taskbookState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          icon="clipboard-outline"
          title="No Active Program"
          message="You are not currently enrolled in an active program."
        />
      </SafeAreaView>
    );
  }

  const groups = groupByType(taskbookState.items);
  const subjectName = paramRosterId ? (roster as any)['Subject Name'] ?? 'Subject' : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {paramRosterId && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {subjectName ?? 'My Taskbook'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {(roster as any)['Program Name'] ?? 'Program'} ·{' '}
            {(currentPhase as any)?.Name ?? 'Current Phase'}
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Phase progress */}
        {currentPhase && (
          <View style={styles.progressSection}>
            <PhaseProgressBar
              phase={currentPhase}
              completedCount={taskbookState.completedCount}
              totalCount={taskbookState.totalCount}
            />
            {(roster as any)['Assigned Trainer Name'] ? (
              <View style={styles.trainerRow}>
                <Ionicons name="person" size={14} color={colors.textSecondary} />
                <Text style={styles.trainerText}>
                  Trainer: {(roster as any)['Assigned Trainer Name']}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Requirements grouped by type */}
        {(Object.entries(groups) as [TaskRequirementType, TaskbookItem[]][])
          .filter(([, items]) => items.length > 0)
          .map(([type, items]) => (
            <View key={type} style={styles.group}>
              <SectionHeader
                title={TYPE_LABELS[type]}
                count={items.length}
              />
              {items.map((item) => (
                <RequirementCard
                  key={item.requirement._id}
                  item={item}
                  onPress={() => handleRequirementPress(item)}
                  onCheckOff={() => handleCheckOff(item)}
                  canCheckOff={canCheckOff(item)}
                />
              ))}
            </View>
          ))}

        {taskbookState.items.length === 0 && (
          <EmptyState
            icon="checkmark-circle-outline"
            title="No Requirements"
            message="This phase has no requirements."
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  scrollContent: { paddingBottom: 24 },
  progressSection: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  trainerText: { fontSize: 13, color: colors.textSecondary },
  group: { marginTop: 8 },
});
