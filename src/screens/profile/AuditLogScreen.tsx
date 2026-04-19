/**
 * AuditLogScreen.tsx
 * Shows paginated user action log pulled from Bubble user logs.
 */

import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { getUserLogs } from '@/api/endpoints/userLogs';

export default function AuditLogScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['userLogs', user?._id],
    queryFn: ({ pageParam }) => getUserLogs(user!._id, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.remaining > 0 ? String(lastPage.logs.length) : undefined,
    enabled: !!user,
  });

  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Log</Text>
      </View>

      {isLoading ? (
        <InlineLoader size="large" />
      ) : logs.length === 0 ? (
        <EmptyState icon="list-outline" title="No Log Entries" message="No audit events recorded yet." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l._id}
          contentContainerStyle={styles.listContent}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <InlineLoader size="small" /> : null}
          renderItem={({ item: log }) => (
            <Card style={styles.logCard}>
              <View style={styles.logRow}>
                <Text style={styles.action}>{log.Action}</Text>
                <Text style={styles.date}>
                  {log['Creation Date']
                    ? format(new Date(log['Creation Date']), 'MMM d, h:mm a')
                    : ''}
                </Text>
              </View>
              {log.Content ? (
                <Text style={styles.content} numberOfLines={2}>{log.Content}</Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700', flex: 1 },
  listContent: { padding: 16, gap: 8 },
  logCard: { marginBottom: 0 },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  date: { fontSize: 12, color: colors.textSecondary },
  content: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
