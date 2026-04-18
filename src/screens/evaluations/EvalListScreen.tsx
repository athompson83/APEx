/**
 * EvalListScreen.tsx
 * Evaluation list — shows Active and Completed evaluations in segmented tabs.
 * Active tab supports pull-to-refresh; Completed tab uses infinite scroll.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { useActiveFormLogs, useCompletedFormLogs } from '@/hooks/useFormLog';
import type { BubbleEvalFormLog, EvalStatus } from '@/types';
import type { EvalNavigationProp } from '@/navigation/types';

// ─── Filter types ─────────────────────────────────────────────────────────────

type EvalTypeFilter = 'all' | 'shift' | 'call' | 'standard';
type TabType = 'active' | 'completed';

// ─── Status color helper ──────────────────────────────────────────────────────

function statusColor(status: EvalStatus): string {
  const map: Record<EvalStatus, string> = {
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

// ─── EvalListItem ─────────────────────────────────────────────────────────────

interface EvalListItemProps {
  formLog: BubbleEvalFormLog;
  onPress: () => void;
}

function EvalListItem({ formLog, onPress }: EvalListItemProps) {
  const color = statusColor(formLog.Status);
  const statusLabel = formLog.Status.replace(/_/g, ' ');
  const dateStr = formLog['Started At']
    ? new Date(formLog['Started At']).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const avgScore = formLog['Average Score'];

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.itemStripe, { backgroundColor: color }]} />
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            Evaluation
          </Text>
          {avgScore !== undefined && (
            <View style={styles.scoreChip}>
              <Text style={styles.scoreChipText}>{avgScore.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemMeta}>
          <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusBadgeText, { color }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.itemDate}>{dateStr}</Text>
        </View>
        {formLog['Call Reference'] && (
          <Text style={styles.itemRef} numberOfLines={1}>
            Ref: {formLog['Call Reference']}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab, filter }: { tab: TabType; filter: EvalTypeFilter }) {
  const hasFilter = filter !== 'all';
  return (
    <View style={styles.emptyState}>
      <Ionicons name="clipboard-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>
        {tab === 'active' ? 'No Active Evaluations' : 'No Completed Evaluations'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasFilter
          ? 'Try removing your filter to see more results.'
          : tab === 'active'
          ? 'Active evaluations will appear here as they are assigned.'
          : 'Completed evaluations will appear here after they are finalized.'}
      </Text>
    </View>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  selected: EvalTypeFilter;
  onChange: (f: EvalTypeFilter) => void;
}

const FILTER_OPTIONS: { label: string; value: EvalTypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Shift', value: 'shift' },
  { label: 'Call', value: 'call' },
  { label: 'Standard', value: 'standard' },
];

function FilterBar({ selected, onChange }: FilterBarProps) {
  return (
    <View style={styles.filterBar}>
      {FILTER_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.filterChip, selected === opt.value && styles.filterChipActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterChipText,
              selected === opt.value && styles.filterChipTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EvalListScreen(): React.JSX.Element {
  const navigation = useNavigation<EvalNavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [typeFilter, setTypeFilter] = useState<EvalTypeFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active evals
  const {
    data: activeFormLogs = [],
    isLoading: activeLoading,
    isError: activeError,
    refetch: refetchActive,
  } = useActiveFormLogs();

  // Completed evals (paginated)
  const {
    data: completedPages,
    isLoading: completedLoading,
    isError: completedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCompletedFormLogs();

  const completedFormLogs = useMemo(
    () => completedPages?.pages.flatMap((p) => p.logs) ?? [],
    [completedPages],
  );

  // Filter logic (type filter applied client-side based on related shift / call reference presence)
  const applyFilter = useCallback(
    (logs: BubbleEvalFormLog[]): BubbleEvalFormLog[] => {
      if (typeFilter === 'all') return logs;
      return logs.filter((log) => {
        if (typeFilter === 'shift') return Boolean(log['Related Shift']);
        if (typeFilter === 'call') return Boolean(log['Call Reference']) && !log['Related Shift'];
        if (typeFilter === 'standard') return !log['Related Shift'] && !log['Call Reference'];
        return true;
      });
    },
    [typeFilter],
  );

  const filteredActive = useMemo(
    () => applyFilter(activeFormLogs).sort((a, b) => {
      const dateA = a['Started At'] ? new Date(a['Started At']).getTime() : 0;
      const dateB = b['Started At'] ? new Date(b['Started At']).getTime() : 0;
      return dateB - dateA;
    }),
    [activeFormLogs, applyFilter],
  );

  const filteredCompleted = useMemo(
    () => applyFilter(completedFormLogs),
    [completedFormLogs, applyFilter],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchActive();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchActive]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const navigateToDetail = useCallback(
    (formLogId: string) => navigation.navigate('EvalDetail', { formLogId }),
    [navigation],
  );

  const isCurrentTabLoading =
    activeTab === 'active' ? activeLoading : completedLoading;
  const isCurrentTabError =
    activeTab === 'active' ? activeError : completedError;
  const currentLogs = activeTab === 'active' ? filteredActive : filteredCompleted;
  const currentCount =
    activeTab === 'active' ? activeFormLogs.length : completedFormLogs.length;

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Screen header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Evaluations</Text>
          {currentCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{currentCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {(['active', 'completed'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'active' ? 'Active' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <FilterBar selected={typeFilter} onChange={setTypeFilter} />

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isCurrentTabLoading && !isRefreshing ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading evaluations…</Text>
        </View>
      ) : isCurrentTabError ? (
        <View style={styles.centeredLoader}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.errorText}>Failed to load evaluations.</Text>
          <TouchableOpacity onPress={() => refetchActive()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentLogs}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <EvalListItem
              formLog={item}
              onPress={() => navigateToDetail(item._id)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            currentLogs.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            activeTab === 'active' ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
          onEndReached={activeTab === 'completed' ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState tab={activeTab} filter={typeFilter} />
          }
          ListFooterComponent={activeTab === 'completed' ? renderFooter : null}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  headerBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.gray500 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '500', color: colors.gray600 },
  filterChipTextActive: { color: colors.white },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  listContentEmpty: { flex: 1 },

  // List item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  itemStripe: { width: 4, alignSelf: 'stretch' },
  itemBody: { flex: 1, padding: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  scoreChip: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  scoreChipText: { fontSize: 12, fontWeight: '700', color: colors.white },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  itemDate: { fontSize: 11, color: colors.gray400 },
  itemRef: { fontSize: 11, color: colors.gray500, marginTop: 4 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Loading / error
  centeredLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 13, color: colors.gray500 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  retryButtonText: { fontSize: 14, fontWeight: '600', color: colors.white },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
});
