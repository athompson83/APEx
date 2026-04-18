/**
 * DashboardSection.tsx
 * Dashboard section container with header, loading skeleton, empty state,
 * and "View All" link.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from '@/components/common/EmptyState';
import { colors } from '@/theme/colors';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard(): React.ReactElement {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.lineShort} />
      <View style={skeletonStyles.lineLong} />
      <View style={skeletonStyles.lineMid} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    gap: 10,
  },
  lineLong: {
    height: 14,
    width: '80%',
    backgroundColor: colors.gray200,
    borderRadius: 4,
  },
  lineMid: {
    height: 12,
    width: '55%',
    backgroundColor: colors.gray200,
    borderRadius: 4,
  },
  lineShort: {
    height: 10,
    width: '30%',
    backgroundColor: colors.gray200,
    borderRadius: 4,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  emptyMessage?: string;
  onViewAll?: () => void;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardSection({
  title,
  count,
  children,
  emptyMessage,
  onViewAll,
  loading = false,
}: DashboardSectionProps): React.ReactElement {
  const hasContent = React.Children.count(children) > 0;

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {count !== undefined && count !== null ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>
        {onViewAll ? (
          <TouchableOpacity
            onPress={onViewAll}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View all ${title}`}
          >
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Content area */}
      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : hasContent ? (
        children
      ) : (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="layers-outline"
            title="Nothing here yet"
            message={emptyMessage ?? `No ${title.toLowerCase()} to display.`}
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyWrapper: {
    minHeight: 160,
  },
});
