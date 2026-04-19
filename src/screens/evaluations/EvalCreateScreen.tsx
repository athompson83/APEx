/**
 * EvalCreateScreen.tsx
 * Create a new evaluation log.
 *
 * Lets an authorized evaluator pick an eval form, select a subject from their
 * assigned roster, and create the BubbleEvalFormLog via the API.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
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

import { colors } from '@/theme/colors';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { getEvalForms } from '@/api/endpoints/evalForms';
import { createFormLog } from '@/api/endpoints/formLogs';
import { getSubjectRosters } from '@/api/endpoints/rosters';
import { logEvalCreated } from '@/services/auditLogger';
import type { BubbleEvalForm, BubbleProgramRoster } from '@/types';
import type { EvalCreateScreenProps } from '@/navigation/types';

export default function EvalCreateScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<EvalCreateScreenProps['route']>();
  const preselectedFormId = route.params?.formId;

  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const [selectedFormId, setSelectedFormId] = useState<string | null>(preselectedFormId ?? null);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);

  const { data: evalForms = [], isLoading: loadingForms } = useQuery({
    queryKey: ['evalForms', 'list'],
    queryFn: () => getEvalForms(),
    enabled: !!user,
  });

  const { data: subjectRosters = [], isLoading: loadingRosters } = useQuery({
    queryKey: ['subjectRosters', user?._id],
    queryFn: () => getSubjectRosters(user!._id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedFormId || !selectedRosterId) throw new Error('Missing selection');
      const roster = subjectRosters.find((r) => r._id === selectedRosterId);
      const log = await createFormLog({
        'Evaluation Form': selectedFormId,
        Evaluator: user._id,
        Evaluated: roster?.Subject as string,
        Roster: selectedRosterId,
        Status: 'draft',
        'Eval Date': new Date().toISOString(),
      });
      await logEvalCreated(log._id, user._id);
      return log;
    },
    onSuccess: (log) => {
      void queryClient.invalidateQueries({ queryKey: ['formLogs'] });
      addToast('Evaluation created', 'success');
      navigation.navigate('EvalScoring' as never, { formLogId: log._id } as never);
    },
    onError: (err: Error) => {
      addToast(err.message ?? 'Failed to create evaluation', 'error');
    },
  });

  const selectedForm = evalForms.find((f) => f._id === selectedFormId);
  const selectedRoster = subjectRosters.find((r) => r._id === selectedRosterId);
  const canCreate = !!selectedFormId && !!selectedRosterId;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Evaluation</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ── Select Form ── */}
        <Text style={styles.sectionLabel}>Evaluation Form</Text>
        {loadingForms ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          evalForms.map((form) => (
            <TouchableOpacity
              key={form._id}
              onPress={() => setSelectedFormId(form._id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFormId === form._id }}
            >
              <Card style={[styles.optionCard, selectedFormId === form._id && styles.optionSelected]}>
                <View style={styles.optionRow}>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{form.Evaluation_Name}</Text>
                    {form.Description ? (
                      <Text style={styles.optionDesc} numberOfLines={2}>{form.Description}</Text>
                    ) : null}
                  </View>
                  {selectedFormId === form._id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* ── Select Subject ── */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Subject</Text>
        {loadingRosters ? (
          <ActivityIndicator color={colors.primary} />
        ) : subjectRosters.length === 0 ? (
          <Text style={styles.emptyText}>No subjects assigned to you.</Text>
        ) : (
          subjectRosters.map((roster) => (
            <TouchableOpacity
              key={roster._id}
              onPress={() => setSelectedRosterId(roster._id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedRosterId === roster._id }}
            >
              <Card
                style={[styles.optionCard, selectedRosterId === roster._id && styles.optionSelected]}
              >
                <View style={styles.optionRow}>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {(roster as any)['Subject Name'] ?? roster.Subject}
                    </Text>
                    {(roster as any)['Program Name'] ? (
                      <Text style={styles.optionDesc}>{(roster as any)['Program Name']}</Text>
                    ) : null}
                  </View>
                  {selectedRosterId === roster._id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        <Button
          title="Create Evaluation"
          onPress={() => createMutation.mutate()}
          variant="primary"
          size="lg"
          fullWidth
          loading={createMutation.isPending}
          disabled={!canCreate}
        />
      </View>
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
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  content: { padding: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optionCard: { marginBottom: 8 },
  optionSelected: { borderWidth: 2, borderColor: colors.primary },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  optionDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
