/**
 * RequirementDetailScreen.tsx
 * Detail view for a single taskbook requirement.
 * Shows completion status, attempt history, references, and sign-off UI.
 */

import React, { useCallback } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useAudit } from '@/hooks/useAudit';
import { getTaskbookLogs, markTaskComplete } from '@/api/endpoints/taskbook';
import { getPhaseRequirements } from '@/api/endpoints/rosters';
import { determineRequirementType, canEvaluatorCheckOff } from '@/engines/taskbookEngine';
import type { RequirementDetailScreenProps } from '@/navigation/types';

const TYPE_COLOR: Record<string, string> = {
  task: colors.info,
  skill: colors.primary,
  assessment_form: colors.warning,
  assessment_quiz: colors.accent,
  assignment: colors.success,
};

export default function RequirementDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RequirementDetailScreenProps['route']>();
  const { requirementId, rosterId } = route.params;

  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const { logTaskCheckedOff } = useAudit();
  const queryClient = useQueryClient();

  const { data: requirements = [] } = useQuery({
    queryKey: ['phaseRequirements', rosterId],
    queryFn: () => getPhaseRequirements('' /* phaseId resolved via roster */),
    enabled: false, // already loaded by parent; just read from cache
  });

  const { data: taskbookLogs = [], isLoading } = useQuery({
    queryKey: ['taskbookLogs', rosterId],
    queryFn: () => getTaskbookLogs(rosterId),
  });

  const requirement = requirements.find((r) => r._id === requirementId);
  const logs = taskbookLogs.filter((l) => l.Requirement === requirementId);
  const latestLog = logs.sort((a, b) =>
    new Date(b['Creation Date'] ?? 0).getTime() - new Date(a['Creation Date'] ?? 0).getTime(),
  )[0];

  const isComplete = !!latestLog?.Success;
  const reqType = requirement ? determineRequirementType(requirement) : 'task';
  const userCanCheckOff = user && requirement ? canEvaluatorCheckOff(requirement, user) : false;

  const signOffMutation = useMutation({
    mutationFn: async () => {
      if (!latestLog) throw new Error('No log record');
      return markTaskComplete(latestLog._id, user!._id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taskbookLogs', rosterId] });
      void logTaskCheckedOff(requirementId, rosterId);
      addToast('Signed off successfully', 'success');
    },
    onError: () => addToast('Failed to sign off', 'error'),
  });

  const handleSignOff = useCallback(() => {
    Alert.alert(
      'Sign Off Requirement',
      `Confirm sign-off for "${requirement?.Name ?? 'this requirement'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Off', onPress: () => signOffMutation.mutate() },
      ],
    );
  }, [requirement, signOffMutation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {requirement?.Name ?? 'Requirement'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons
              name={isComplete ? 'checkmark-circle' : 'ellipse-outline'}
              size={32}
              color={isComplete ? colors.success : colors.gray300}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusLabel}>{isComplete ? 'Complete' : 'Incomplete'}</Text>
              {latestLog?.['Completed By Name'] && (
                <Text style={styles.statusMeta}>
                  Signed off by {latestLog['Completed By Name']}
                </Text>
              )}
              {latestLog?.['Creation Date'] && isComplete && (
                <Text style={styles.statusMeta}>
                  {format(new Date(latestLog['Creation Date']), 'MMM d, yyyy')}
                </Text>
              )}
            </View>
            <Badge
              label={reqType.replace('_', ' ')}
              color={TYPE_COLOR[reqType] ?? colors.gray300}
              textColor={colors.white}
            />
          </View>
        </Card>

        {/* Description */}
        {requirement?.Description ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.body}>{requirement.Description}</Text>
          </Card>
        ) : null}

        {/* Reference link */}
        {(requirement as any)?.['Reference Link'] ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Reference</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL((requirement as any)['Reference Link'])}
            >
              <Text style={styles.linkText}>View Reference Material</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Attempt history */}
        {logs.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Attempt History ({logs.length})</Text>
            {logs.map((log, i) => (
              <View key={log._id} style={[styles.attemptRow, i > 0 && styles.attemptDivider]}>
                <Ionicons
                  name={log.Success ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={log.Success ? colors.success : colors.danger}
                />
                <Text style={styles.attemptText}>
                  Attempt {log['Attempt Number'] ?? i + 1}
                  {log['Creation Date']
                    ? ` · ${format(new Date(log['Creation Date']), 'MMM d, yyyy')}`
                    : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Sign-off action */}
        {userCanCheckOff && !isComplete && (
          <Button
            title="Sign Off Requirement"
            onPress={handleSignOff}
            variant="primary"
            size="lg"
            fullWidth
            loading={signOffMutation.isPending}
            style={styles.signOffBtn}
          />
        )}

        <View style={{ height: 32 }} />
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
  statusCard: { marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusText: { flex: 1 },
  statusLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: { marginBottom: 4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  linkText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  attemptDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  attemptText: { fontSize: 14, color: colors.textPrimary },
  signOffBtn: { marginTop: 8 },
});
