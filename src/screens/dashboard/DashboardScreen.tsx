/**
 * DashboardScreen.tsx
 * Main home dashboard — the first screen authenticated users see.
 * Role-aware sections surface the most relevant information for each role.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFormLogs, useFormLogsNeedingAction } from '@/hooks/useFormLog';
import { useAuthStore } from '@/store/authStore';
import { getMyRoster } from '@/api/endpoints/rosters';
import { getUserDisplayName } from '@/types/user';
import type { BubbleEvalFormLog } from '@/types';
import type { EvalNavigationProp } from '@/navigation/types';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  count?: number;
  accent?: boolean;
}

function SectionHeader({ title, count, accent }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, accent && styles.sectionTitleAccent]}>
        {title}
      </Text>
      {count !== undefined && (
        <View style={[styles.countBadge, accent && styles.countBadgeAccent]}>
          <Text style={[styles.countBadgeText, accent && styles.countBadgeTextAccent]}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

interface ActionCardProps {
  formLog: BubbleEvalFormLog;
  onPress: () => void;
}

function ActionCard({ formLog, onPress }: ActionCardProps) {
  const statusLabel = formLog.Status.replace(/_/g, ' ');
  const date = formLog['Started At']
    ? new Date(formLog['Started At']).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'No date';

  return (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.actionCardLeft}>
        <View style={styles.actionDot} />
      </View>
      <View style={styles.actionCardBody}>
        <Text style={styles.actionCardTitle} numberOfLines={1}>
          Evaluation Needs Action
        </Text>
        <Text style={styles.actionCardStatus}>{statusLabel}</Text>
        <Text style={styles.actionCardDate}>{date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.accent} />
    </TouchableOpacity>
  );
}

interface EvalCardRowProps {
  formLog: BubbleEvalFormLog;
  onPress: () => void;
}

function EvalCardRow({ formLog, onPress }: EvalCardRowProps) {
  const statusColorMap: Record<string, string> = {
    draft: colors.gray400,
    in_progress: colors.info,
    pending_review: colors.warning,
    approved: colors.success,
    disputed: colors.danger,
    complete: colors.success,
    archived: colors.gray400,
  };
  const statusColor = statusColorMap[formLog.Status] ?? colors.gray400;
  const statusLabel = formLog.Status.replace(/_/g, ' ');
  const date = formLog['Started At']
    ? new Date(formLog['Started At']).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'No date';

  return (
    <TouchableOpacity
      style={styles.evalCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.evalCardStripe, { backgroundColor: statusColor }]} />
      <View style={styles.evalCardBody}>
        <Text style={styles.evalCardTitle} numberOfLines={1}>
          Evaluation
        </Text>
        <View style={styles.evalCardMeta}>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
          <Text style={styles.evalCardDate}>{date}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
    </TouchableOpacity>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{message}</Text>
    </View>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.sectionError}>
      <Text style={styles.sectionErrorText}>Failed to load. </Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.sectionErrorRetry}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<EvalNavigationProp>();
  const { user } = useAuth();
  const role = user?.['APEx Role'] ?? 'subject';
  const userId = user?._id ?? '';

  // ── Data queries ────────────────────────────────────────────────────────────
  const {
    data: activeFormLogs = [],
    isLoading: activeLoading,
    isError: activeError,
    refetch: refetchActive,
  } = useActiveFormLogs();

  const {
    data: actionFormLogs = [],
    isLoading: actionLoading,
    isError: actionError,
    refetch: refetchAction,
  } = useFormLogsNeedingAction();

  const {
    data: roster,
    isLoading: rosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['myRoster', userId],
    queryFn: () => getMyRoster(userId),
    enabled: Boolean(userId) && (role === 'subject'),
    staleTime: 5 * 60_000,
  });

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchActive(), refetchAction(), refetchRoster()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchActive, refetchAction, refetchRoster]);

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const goToEvalDetail = useCallback(
    (formLogId: string) => {
      navigation.navigate('EvalDetail', { formLogId });
    },
    [navigation],
  );

  const isLoading = activeLoading || actionLoading;
  const displayName = user ? getUserDisplayName(user) : 'there';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting header ──────────────────────────────────────────── */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingName}>Hello, {displayName.split(' ')[0]}</Text>
            <Text style={styles.greetingRole}>{getRoleLabel(role)}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>
          </View>
        </View>

        {isLoading && !refreshing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Loading dashboard…</Text>
          </View>
        )}

        {/* ── Needs My Action (prominent, accent-colored) ──────────────── */}
        {(actionFormLogs.length > 0 || actionError) && (
          <View style={styles.section}>
            <SectionHeader
              title="Needs My Action"
              count={actionFormLogs.length}
              accent
            />
            {actionError ? (
              <SectionError onRetry={refetchAction} />
            ) : (
              actionFormLogs.map((log) => (
                <ActionCard
                  key={log._id}
                  formLog={log}
                  onPress={() => goToEvalDetail(log._id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── My Active Evaluations (all roles) ───────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="My Active Evaluations"
            count={activeFormLogs.length}
          />
          {activeError ? (
            <SectionError onRetry={refetchActive} />
          ) : activeFormLogs.length === 0 && !activeLoading ? (
            <EmptySection message="No active evaluations." />
          ) : (
            activeFormLogs.slice(0, 5).map((log) => (
              <EvalCardRow
                key={log._id}
                formLog={log}
                onPress={() => goToEvalDetail(log._id)}
              />
            ))
          )}
          {activeFormLogs.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('EvalList')}
            >
              <Text style={styles.viewAllText}>
                View all {activeFormLogs.length} evaluations
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Subject: Taskbook Progress ───────────────────────────────── */}
        {role === 'subject' && (
          <View style={styles.section}>
            <SectionHeader title="My Taskbook Progress" />
            {rosterLoading ? (
              <ActivityIndicator
                color={colors.primary}
                size="small"
                style={styles.sectionSpinner}
              />
            ) : roster ? (
              <TouchableOpacity
                style={styles.rosterCard}
                onPress={() => navigation.navigate('Taskbook')}
                activeOpacity={0.82}
              >
                <View style={styles.rosterCardContent}>
                  <Ionicons name="checkbox-outline" size={24} color={colors.primary} />
                  <View style={styles.rosterCardText}>
                    <Text style={styles.rosterCardTitle}>Active Program</Text>
                    <Text style={styles.rosterCardSub}>
                      Started {new Date(roster['Start Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>
            ) : (
              <EmptySection message="No active training program assigned." />
            )}
          </View>
        )}

        {/* ── Evaluator: Quick stats ───────────────────────────────────── */}
        {(role === 'evaluator' || role === 'admin') && (
          <View style={styles.section}>
            <SectionHeader title="Evaluation Activity" />
            <View style={styles.statsRow}>
              <StatBox
                label="Active"
                value={activeFormLogs.filter(l => ['draft', 'in_progress'].includes(l.Status)).length}
                color={colors.info}
              />
              <StatBox
                label="Pending Review"
                value={activeFormLogs.filter(l => l.Status === 'pending_review').length}
                color={colors.warning}
              />
              <StatBox
                label="Needs Action"
                value={actionFormLogs.length}
                color={colors.accent}
              />
            </View>
          </View>
        )}

        {/* ── Reviewer: Queue summary ──────────────────────────────────── */}
        {(role === 'reviewer' || role === 'admin') && (
          <View style={styles.section}>
            <SectionHeader title="Reviewer Queue" />
            {actionFormLogs.length === 0 ? (
              <View style={styles.reviewerAllClearCard}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <Text style={styles.reviewerAllClearText}>
                  All caught up — no evals awaiting review.
                </Text>
              </View>
            ) : (
              <View style={styles.reviewerQueueBanner}>
                <Ionicons name="time-outline" size={20} color={colors.warning} />
                <Text style={styles.reviewerQueueText}>
                  {actionFormLogs.length} evaluation{actionFormLogs.length !== 1 ? 's' : ''} awaiting your review
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Small stat box ───────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={[styles.statBoxValue, { color }]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    evaluator: 'Field Training Officer',
    subject: 'Intern / Trainee',
    reviewer: 'Program Reviewer',
    admin: 'Administrator',
  };
  return labels[role] ?? 'APEx360 User';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  // Greeting
  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.primary,
  },
  greetingName: { fontSize: 20, fontWeight: '700', color: colors.white },
  greetingRole: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white, letterSpacing: 0.5 },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: colors.gray500 },

  // Sections
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  sectionTitleAccent: { color: colors.accent },
  countBadge: {
    backgroundColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeAccent: { backgroundColor: `${colors.accent}20` },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: colors.gray600 },
  countBadgeTextAccent: { color: colors.accent },

  // Action cards (orange - high priority)
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: `${colors.accent}40`,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCardLeft: { marginRight: 12 },
  actionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  actionCardBody: { flex: 1 },
  actionCardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  actionCardStatus: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  actionCardDate: { fontSize: 11, color: colors.gray500, marginTop: 2 },

  // Eval cards
  evalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  evalCardStripe: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: 12,
  },
  evalCardBody: { flex: 1 },
  evalCardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  evalCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  evalCardDate: { fontSize: 11, color: colors.gray500 },

  // View all link
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  // Roster card
  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rosterCardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rosterCardText: { flex: 1 },
  rosterCardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rosterCardSub: { fontSize: 12, color: colors.gray500, marginTop: 2 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statBoxValue: { fontSize: 24, fontWeight: '700' },
  statBoxLabel: { fontSize: 11, color: colors.gray500, marginTop: 4, textAlign: 'center' },

  // Reviewer cards
  reviewerAllClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successLight,
    borderRadius: 12,
    padding: 14,
  },
  reviewerAllClearText: { flex: 1, fontSize: 14, color: colors.success, fontWeight: '500' },
  reviewerQueueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningLight,
    borderRadius: 12,
    padding: 14,
  },
  reviewerQueueText: { flex: 1, fontSize: 14, color: colors.warning, fontWeight: '500' },

  // Misc
  emptySection: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  emptySectionText: { fontSize: 14, color: colors.gray400, fontStyle: 'italic' },
  sectionError: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  sectionErrorText: { fontSize: 13, color: colors.gray500 },
  sectionErrorRetry: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  sectionSpinner: { marginVertical: 12 },
  bottomPad: { height: 32 },
});
