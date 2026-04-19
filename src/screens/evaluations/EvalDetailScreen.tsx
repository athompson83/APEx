/**
 * EvalDetailScreen.tsx
 * Evaluation detail and overview screen.
 * Shows eval context, participants, workflow state, scoring summary,
 * and contextual action buttons based on user permissions.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { colors } from '@/theme/colors';
import { useFormLog, formLogKeys } from '@/hooks/useFormLog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { getWorkflowLog, getWorkflowSteps } from '@/api/endpoints/workflows';
import { getFormLog } from '@/api/endpoints/formLogs';
import { callWorkflow } from '@/api/bubble';
import { logStepCompleted } from '@/services/auditLogger';
import { evalStatusLabels } from '@/types/evalFormLog';
import { getUserDisplayName } from '@/types/user';
import type {
  BubbleEvalFormLog,
  BubbleEvalWorkflowLog,
  BubbleFormWorkflowStep,
  WorkflowAction,
} from '@/types';
import type { EvalDetailScreenProps, EvalNavigationProp } from '@/navigation/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: colors.gray400,
    in_progress: colors.info,
    pending_review: colors.warning,
    approved: colors.success,
    disputed: colors.danger,
    complete: colors.success,
    archived: colors.gray400,
  };
  return map[status] ?? colors.gray400;
}

function stepStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: colors.gray300,
    active: colors.info,
    approved: colors.success,
    disputed: colors.danger,
    returned: colors.warning,
    skipped: colors.gray300,
  };
  return map[status] ?? colors.gray300;
}

// ─── Section components ───────────────────────────────────────────────────────

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={styles.infoRow}>
      {icon && (
        <Ionicons name={icon as any} size={16} color={colors.gray400} style={styles.infoIcon} />
      )}
      <View style={styles.infoRowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

interface WorkflowBarProps {
  steps: BubbleFormWorkflowStep[];
  workflowLog: BubbleEvalWorkflowLog;
}

function WorkflowBar({ steps, workflowLog }: WorkflowBarProps) {
  const sortedSteps = [...steps].sort((a, b) => a.Rank - b.Rank);
  const stepLogs = workflowLog.StepLogs ?? [];

  return (
    <View style={styles.workflowBar}>
      {sortedSteps.map((step, index) => {
        const stepLog = stepLogs.find((sl) => sl['Workflow Step'] === step._id);
        const stepStatus = stepLog?.Status ?? 'pending';
        const isActive = workflowLog['Current Step'] === step._id;
        const color = isActive ? colors.info : stepStatusColor(stepStatus);

        return (
          <React.Fragment key={step._id}>
            <View style={styles.workflowStep}>
              <View
                style={[
                  styles.workflowStepDot,
                  { backgroundColor: color },
                  isActive && styles.workflowStepDotActive,
                ]}
              >
                {stepStatus === 'approved' ? (
                  <Ionicons name="checkmark" size={10} color={colors.white} />
                ) : stepStatus === 'disputed' ? (
                  <Ionicons name="close" size={10} color={colors.white} />
                ) : null}
              </View>
              <Text style={[styles.workflowStepLabel, isActive && styles.workflowStepLabelActive]} numberOfLines={2}>
                {step['Step Name']}
              </Text>
            </View>
            {index < sortedSteps.length - 1 && (
              <View
                style={[
                  styles.workflowConnector,
                  { backgroundColor: stepStatus === 'approved' ? colors.success : colors.gray200 },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'danger' | 'outline';
  loading?: boolean;
  icon?: string;
  disabled?: boolean;
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  icon,
  disabled,
}: ActionButtonProps) {
  const bgColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'accent'
      ? colors.accent
      : variant === 'danger'
      ? colors.danger
      : 'transparent';

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: bgColor },
        variant === 'outline' && styles.actionButtonOutline,
        (loading || disabled) && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'outline' ? colors.primary : colors.white} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon as any}
              size={16}
              color={variant === 'outline' ? colors.primary : colors.white}
              style={styles.actionButtonIcon}
            />
          )}
          <Text
            style={[
              styles.actionButtonText,
              variant === 'outline' && styles.actionButtonTextOutline,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EvalDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<EvalNavigationProp>();
  const route = useRoute<EvalDetailScreenProps['route']>();
  const { formLogId } = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [disputeNote, setDisputeNote] = useState('');
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data queries ────────────────────────────────────────────────────────────
  const {
    data: formLog,
    isLoading: logLoading,
    isError: logError,
    refetch: refetchLog,
  } = useFormLog(formLogId);

  const {
    data: workflowLogs = [],
    isLoading: workflowLoading,
    refetch: refetchWorkflow,
  } = useQuery({
    queryKey: ['workflowLog', formLogId],
    queryFn: () => getWorkflowLog(formLogId),
    enabled: Boolean(formLogId),
    staleTime: 30_000,
  });

  const workflowLog = workflowLogs[0] as BubbleEvalWorkflowLog | undefined;

  const currentStepId = workflowLog?.['Current Step'];

  const { data: workflowSteps = [] } = useQuery({
    queryKey: ['workflowSteps', workflowLog?.['Form Workflow']],
    queryFn: () => getWorkflowSteps(workflowLog!['Form Workflow']),
    enabled: Boolean(workflowLog?.['Form Workflow']),
    staleTime: 5 * 60_000,
  });

  const currentStep = workflowSteps.find((s) => s._id === currentStepId);

  // ── Permissions ─────────────────────────────────────────────────────────────
  const permissions = usePermissions(formLog, formLog?.['Form Settings'] as any, currentStep);

  // ── Pull to refresh ─────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchLog(), refetchWorkflow()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchLog, refetchWorkflow]);

  // ── Workflow actions ────────────────────────────────────────────────────────
  const handleWorkflowAction = useCallback(
    async (action: WorkflowAction, comment?: string) => {
      if (!formLog || !currentUser) return;
      setWorkflowActionLoading(true);
      try {
        await callWorkflow('action_eval_workflow_step', {
          formLogId: formLog._id,
          action,
          comment: comment ?? '',
          userId: currentUser._id,
        });
        await logStepCompleted(
          formLog._id,
          currentStepId ?? '',
          action,
          currentUser._id,
        );
        void queryClient.invalidateQueries({ queryKey: formLogKeys.detail(formLogId) });
        void queryClient.invalidateQueries({ queryKey: ['workflowLog', formLogId] });
      } catch (err) {
        Alert.alert(
          'Action Failed',
          err instanceof Error ? err.message : 'Unable to complete this action. Please try again.',
        );
      } finally {
        setWorkflowActionLoading(false);
      }
    },
    [formLog, currentUser, currentStepId, queryClient, formLogId],
  );

  const handleApprove = useCallback(() => {
    Alert.alert(
      'Approve Evaluation',
      'Are you sure you want to approve this evaluation? This will advance it to the next workflow step.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => void handleWorkflowAction('approve'),
        },
      ],
    );
  }, [handleWorkflowAction]);

  const handleDispute = useCallback(() => {
    Alert.prompt(
      'Dispute Evaluation',
      'Please provide a reason for this dispute (required):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Dispute',
          style: 'destructive',
          onPress: (note) => {
            if (!note || note.trim().length === 0) {
              Alert.alert('Note Required', 'You must provide a reason before disputing.');
              return;
            }
            void handleWorkflowAction('dispute', note.trim());
          },
        },
      ],
      'plain-text',
    );
  }, [handleWorkflowAction]);

  const handleSubmit = useCallback(() => {
    Alert.alert(
      'Submit Evaluation',
      'Submit this evaluation for review? You will not be able to change scores after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => void handleWorkflowAction('submit'),
        },
      ],
    );
  }, [handleWorkflowAction]);

  // ── Loading / error states ──────────────────────────────────────────────────
  const isLoading = logLoading || workflowLoading;

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading evaluation…</Text>
      </View>
    );
  }

  if (logError || !formLog) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={styles.errorTitle}>Could not load evaluation</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void refetchLog()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sColor = statusColor(formLog.Status);
  const statusLabel = evalStatusLabels[formLog.Status] ?? formLog.Status;
  const dateStr = formLog['Started At']
    ? new Date(formLog['Started At']).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date unknown';

  const canScore =
    permissions.canEdit &&
    (permissions.isEvaluator || permissions.effectiveRole === 'evaluator');
  const canViewScores = permissions.canViewScores || permissions.isEvaluator;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status header ────────────────────────────────────────────── */}
        <View style={[styles.statusHeader, { borderLeftColor: sColor }]}>
          <View style={styles.statusHeaderTop}>
            <View style={[styles.statusBadge, { backgroundColor: `${sColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: sColor }]} />
              <Text style={[styles.statusBadgeText, { color: sColor }]}>{statusLabel}</Text>
            </View>
            {formLog['Average Score'] !== undefined && (
              <View style={styles.avgScoreChip}>
                <Text style={styles.avgScoreLabel}>Avg</Text>
                <Text style={styles.avgScoreValue}>
                  {formLog['Average Score'].toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.evalDateLabel}>{dateStr}</Text>
          {formLog['Call Reference'] && (
            <Text style={styles.callRef}>Ref: {formLog['Call Reference']}</Text>
          )}
        </View>

        {/* ── Participants ─────────────────────────────────────────────── */}
        <CardSection title="Participants">
          <InfoRow label="Subject (Trainee)" value={formLog.Subject} icon="person-outline" />
          <InfoRow label="Evaluator (FTO)" value={formLog.Evaluator} icon="person-circle-outline" />
          {formLog['Current Workflow Step'] && (
            <InfoRow
              label="Current Step"
              value={currentStep?.['Step Name'] ?? 'Loading…'}
              icon="git-branch-outline"
            />
          )}
        </CardSection>

        {/* ── Workflow progress ────────────────────────────────────────── */}
        {workflowLog && workflowSteps.length > 0 && (
          <CardSection title="Workflow Progress">
            <WorkflowBar steps={workflowSteps} workflowLog={workflowLog} />
            {currentStep?.Instructions && (
              <View style={styles.stepInstructions}>
                <Ionicons name="information-circle-outline" size={15} color={colors.info} />
                <Text style={styles.stepInstructionsText}>{currentStep.Instructions}</Text>
              </View>
            )}
          </CardSection>
        )}

        {/* ── Scoring summary ──────────────────────────────────────────── */}
        {canViewScores && (
          <CardSection title="Scoring Summary">
            {formLog['Average Score'] !== undefined ? (
              <View style={styles.scoreSummaryRow}>
                <View style={styles.scoreSummaryBox}>
                  <Text style={styles.scoreSummaryValue}>
                    {formLog['Average Score'].toFixed(2)}
                  </Text>
                  <Text style={styles.scoreSummaryLabel}>Overall Average</Text>
                </View>
                <View style={styles.scoreSummaryDivider} />
                <View style={styles.scoreSummaryBox}>
                  <Text style={styles.scoreSummaryValue}>
                    {formLog['Score Logs']?.length ?? 0}
                  </Text>
                  <Text style={styles.scoreSummaryLabel}>Attributes Scored</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.scoreSummaryEmpty}>
                No scores recorded yet.
              </Text>
            )}
            {formLog['Overall Comments'] && (
              <View style={styles.overallComments}>
                <Text style={styles.overallCommentsLabel}>Evaluator Comments</Text>
                <Text style={styles.overallCommentsText}>{formLog['Overall Comments']}</Text>
              </View>
            )}
          </CardSection>
        )}

        {/* ── Acknowledgement status ───────────────────────────────────── */}
        {formLog['Subject Acknowledged'] && (
          <View style={styles.acknowledgedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.acknowledgedText}>
              Subject acknowledged{' '}
              {formLog['Acknowledged At']
                ? `on ${new Date(formLog['Acknowledged At']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : ''}
            </Text>
          </View>
        )}

        {/* ── Subject dispute response ─────────────────────────────────── */}
        {formLog['Subject Response'] && (
          <CardSection title="Subject Response / Dispute Reason">
            <Text style={styles.subjectResponse}>{formLog['Subject Response']}</Text>
          </CardSection>
        )}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          {canScore && (
            <ActionButton
              label="Score Evaluation"
              icon="create-outline"
              variant="primary"
              onPress={() => navigation.navigate('EvalScoring', { formLogId: formLog._id })}
            />
          )}
          {!canScore && canViewScores && (
            <ActionButton
              label="View Scores"
              icon="eye-outline"
              variant="outline"
              onPress={() => navigation.navigate('EvalScoring', { formLogId: formLog._id })}
            />
          )}
          {permissions.canApprove && (
            <ActionButton
              label="Approve"
              icon="checkmark-circle-outline"
              variant="accent"
              loading={workflowActionLoading}
              onPress={handleApprove}
            />
          )}
          {permissions.isEvaluator && formLog.Status === 'in_progress' && (
            <ActionButton
              label="Submit for Review"
              icon="paper-plane-outline"
              variant="primary"
              loading={workflowActionLoading}
              onPress={handleSubmit}
            />
          )}
          {permissions.canDispute && currentStep?.['Dispute Allowed'] && (
            <ActionButton
              label="Dispute"
              icon="warning-outline"
              variant="danger"
              loading={workflowActionLoading}
              onPress={handleDispute}
            />
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  // Loading / error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 13, color: colors.gray500 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: { fontSize: 14, fontWeight: '600', color: colors.white },

  // Status header
  statusHeader: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statusHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  avgScoreChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  avgScoreLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  avgScoreValue: { fontSize: 18, color: colors.white, fontWeight: '700' },
  evalDateLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  callRef: { fontSize: 12, color: colors.gray500, marginTop: 4 },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  cardContent: {},

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  infoIcon: { marginRight: 10, marginTop: 2 },
  infoRowContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.gray400, fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },

  // Workflow bar
  workflowBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    paddingVertical: 4,
  },
  workflowStep: { flex: 1, alignItems: 'center', gap: 6 },
  workflowStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowStepDotActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.info,
  },
  workflowStepLabel: {
    fontSize: 10,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 14,
  },
  workflowStepLabelActive: { color: colors.info, fontWeight: '600' },
  workflowConnector: {
    height: 2,
    width: 16,
    marginTop: 11,
    flexShrink: 0,
  },
  stepInstructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.infoLight,
    padding: 10,
    borderRadius: 8,
  },
  stepInstructionsText: { flex: 1, fontSize: 12, color: colors.info, lineHeight: 18 },

  // Score summary
  scoreSummaryRow: { flexDirection: 'row', alignItems: 'center' },
  scoreSummaryBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  scoreSummaryValue: { fontSize: 28, fontWeight: '700', color: colors.primary },
  scoreSummaryLabel: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  scoreSummaryDivider: { width: 1, height: 40, backgroundColor: colors.border },
  scoreSummaryEmpty: { fontSize: 13, color: colors.gray400, fontStyle: 'italic' },
  overallComments: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  overallCommentsLabel: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginBottom: 4 },
  overallCommentsText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },

  // Acknowledged banner
  acknowledgedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  acknowledgedText: { fontSize: 13, color: colors.success, fontWeight: '500' },

  // Subject response
  subjectResponse: { fontSize: 14, color: colors.textPrimary, lineHeight: 22, fontStyle: 'italic' },

  // Action buttons
  actionsSection: { gap: 10, marginTop: 4 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonIcon: {},
  actionButtonText: { fontSize: 15, fontWeight: '700', color: colors.white },
  actionButtonTextOutline: { color: colors.primary },

  bottomPad: { height: 40 },
});
