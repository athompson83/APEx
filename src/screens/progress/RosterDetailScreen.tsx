/**
 * RosterDetailScreen.tsx
 * Reviewer / evaluator view of a subject's roster and program progress.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/common/Button';
import { getRoster, getCurrentPhase } from '@/api/endpoints/rosters';
import type { RosterDetailScreenProps } from '@/navigation/types';

export default function RosterDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RosterDetailScreenProps['route']>();
  const { rosterId } = route.params;

  const { data: roster, isLoading } = useQuery({
    queryKey: ['roster', rosterId],
    queryFn: () => getRoster(rosterId),
  });

  const { data: currentPhase } = useQuery({
    queryKey: ['currentPhase', rosterId],
    queryFn: () => getCurrentPhase(rosterId),
    enabled: !!roster,
  });

  if (isLoading) return <InlineLoader size="large" />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {(roster as any)?.['Subject Name'] ?? 'Subject Roster'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.sectionTitle}>Program</Text>
          <Text style={styles.value}>{(roster as any)?.['Program Name'] ?? '—'}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Current Phase</Text>
          <Text style={styles.value}>{(currentPhase as any)?.Name ?? '—'}</Text>

          {(roster as any)?.['End Date'] && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>End Date</Text>
              <Text style={styles.value}>
                {format(new Date((roster as any)['End Date']), 'MMMM d, yyyy')}
              </Text>
            </>
          )}

          {(roster as any)?.['Assigned Trainer Name'] && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Assigned Trainer</Text>
              <Text style={styles.value}>{(roster as any)['Assigned Trainer Name']}</Text>
            </>
          )}
        </Card>

        <Button
          title="View Taskbook"
          onPress={() =>
            navigation.navigate('TaskbookHome' as never, { rosterId } as never)
          }
          variant="primary"
          size="lg"
          fullWidth
          style={{ marginTop: 8 }}
          icon="clipboard-outline"
        />

        <Button
          title="View Evaluations"
          onPress={() =>
            navigation.navigate('EvalList' as never, { rosterId } as never)
          }
          variant="outline"
          size="lg"
          fullWidth
          style={{ marginTop: 8 }}
          icon="document-text-outline"
        />
      </ScrollView>
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
  content: { padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
});
