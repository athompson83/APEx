/**
 * EvalScoringScreen.tsx
 * Core evaluation scoring experience — optimised for fast field use.
 *
 * Loads the full rendered form from Bubble, renders expandable category cards,
 * handles optimistic score updates, auto-saves progress, and enforces
 * feedback requirements dynamically from score settings.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { CategoryCard } from '@/components/eval/CategoryCard';
import { Button } from '@/components/common/Button';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { useEvalStore } from '@/store/evalStore';
import { useUIStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useAudit } from '@/hooks/useAudit';
import { getFormLog } from '@/api/endpoints/formLogs';
import { getEvalForm, getEvalCategories, getEvalScoreSettings } from '@/api/endpoints/evalForms';
import { getScoreLogs, upsertScoreLog } from '@/api/endpoints/scores';
import { getEvalFormSettings } from '@/api/endpoints/evalForms';
import {
  buildRenderedForm,
  getCompletionPercentage,
  isFormComplete,
  mergeScoreUpdate,
  type RenderedEvalForm,
} from '@/engines/evaluationRenderer';
import type { EvalScoringScreenProps } from '@/navigation/types';

const AUTOSAVE_DEBOUNCE_MS = 30_000;

export default function EvalScoringScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<EvalScoringScreenProps['route']>();
  const { formLogId, categoryId: jumpToCategoryId } = route.params;

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { pendingScores, updatePendingScore, clearPendingScores, setCurrentRenderedForm } =
    useEvalStore();
  const addToast = useUIStore((s) => s.addToast);
  const { logScoreEntered, logScoreUpdated } = useAudit();

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    jumpToCategoryId ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const { data: formLog, isLoading: loadingLog } = useQuery({
    queryKey: ['formLogs', 'detail', formLogId],
    queryFn: () => getFormLog(formLogId),
    enabled: !!formLogId,
  });

  const formId = formLog?.['Evaluation Form'];

  const { data: evalForm, isLoading: loadingForm } = useQuery({
    queryKey: ['evalForms', 'detail', formId],
    queryFn: () => getEvalForm(formId!),
    enabled: !!formId,
  });

  const { data: formSettings } = useQuery({
    queryKey: ['evalFormSettings', formId],
    queryFn: () => getEvalFormSettings(formId!),
    enabled: !!formId,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['evalCategories', formId],
    queryFn: () => getEvalCategories(formId!),
    enabled: !!formId,
  });

  const { data: scoreSettings, isLoading: loadingScoreSettings } = useQuery({
    queryKey: ['evalScoreSettings', formId],
    queryFn: () => getEvalScoreSettings(formId!),
    enabled: !!formId,
  });

  const { data: existingScoreLogs = [], isLoading: loadingScoreLogs } = useQuery({
    queryKey: ['scoreLogs', formLogId],
    queryFn: () => getScoreLogs(formLogId),
    enabled: !!formLogId,
  });

  const { canEdit: canScore } = usePermissions(formLog ?? undefined, formSettings ?? undefined);

  // ─── Build rendered form ────────────────────────────────────────────────────

  const renderedForm = useMemo<RenderedEvalForm | null>(() => {
    if (!evalForm || !formSettings || !scoreSettings || categories.length === 0) return null;
    return buildRenderedForm(
      evalForm,
      formSettings,
      categories,
      {},
      scoreSettings,
      existingScoreLogs,
    );
  }, [evalForm, formSettings, scoreSettings, categories, existingScoreLogs]);

  // Merge pending (unsaved) scores into the rendered form for optimistic display
  const displayForm = useMemo<RenderedEvalForm | null>(() => {
    if (!renderedForm) return null;
    let form = renderedForm;
    for (const [attributeId, { score, notes }] of Object.entries(pendingScores)) {
      const categoryId = categories.find((c) =>
        renderedForm.categories
          .find((rc) => rc.id === c._id)
          ?.attributes.some((a) => a.id === attributeId),
      )?._id;
      if (categoryId) {
        form = mergeScoreUpdate(form, categoryId, attributeId, score, notes);
      }
    }
    return form;
  }, [renderedForm, pendingScores, categories]);

  useEffect(() => {
    if (displayForm) setCurrentRenderedForm(displayForm);
  }, [displayForm, setCurrentRenderedForm]);

  // Auto-expand the first incomplete category on load
  useEffect(() => {
    if (!displayForm || expandedCategoryId) return;
    const first = displayForm.categories.find(
      (c) => c.attributes.some((a) => a.currentScore === undefined),
    );
    if (first) setExpandedCategoryId(first.id);
  }, [displayForm, expandedCategoryId]);

  // ─── Score mutation ─────────────────────────────────────────────────────────

  const saveScoreMutation = useMutation({
    mutationFn: async (
      entries: Array<{ categoryId: string; attributeId: string; score: number; notes?: string }>,
    ) => {
      if (!user || !formLog) throw new Error('Missing context');
      const results = await Promise.allSettled(
        entries.map((e) =>
          upsertScoreLog(formLogId, e.categoryId, e.attributeId, {
            Attribute: e.attributeId,
            Category: e.categoryId,
            Eval_ID: formLogId,
            Score: e.score,
            Notes: e.notes,
            Evaluator: user._id,
            Evaluated: formLog['Evaluated User'],
          }),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length) throw new Error(`${failures.length} score(s) failed to save`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scoreLogs', formLogId] });
      clearPendingScores();
      addToast('Progress saved', 'success');
    },
    onError: (err: Error) => {
      addToast(err.message ?? 'Failed to save scores', 'error');
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleScoreAttribute = useCallback(
    (categoryId: string, attributeId: string, score: number, notes?: string) => {
      const existing = existingScoreLogs.find((l) => l.Attribute === attributeId);
      updatePendingScore(attributeId, score, notes);
      if (existing) {
        void logScoreUpdated(formLogId, categoryId, score);
      } else {
        void logScoreEntered(formLogId, categoryId, score);
      }
      // Reset debounced auto-save
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        triggerSave();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [existingScoreLogs, updatePendingScore, logScoreEntered, logScoreUpdated, formLogId],
  );

  const triggerSave = useCallback(() => {
    const entries = Object.entries(pendingScores).map(([attributeId, { score, notes }]) => {
      // Find categoryId for this attribute
      const categoryId =
        displayForm?.categories.find((c) => c.attributes.some((a) => a.id === attributeId))?.id ??
        '';
      return { categoryId, attributeId, score, notes };
    });
    if (entries.length === 0) return;
    saveScoreMutation.mutate(entries);
  }, [pendingScores, displayForm, saveScoreMutation]);

  const handleSaveProgress = useCallback(() => {
    triggerSave();
  }, [triggerSave]);

  const handleCompleteAndSubmit = useCallback(() => {
    if (!displayForm || !isFormComplete(displayForm)) {
      addToast('All required fields must be scored before submitting', 'warning');
      return;
    }
    Alert.alert(
      'Submit Evaluation',
      'Save all scores and advance this evaluation to the next workflow step?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            triggerSave();
            navigation.goBack();
          },
        },
      ],
    );
  }, [displayForm, triggerSave, addToast, navigation]);

  // Warn on back navigation if unsaved changes exist
  const hasPending = Object.keys(pendingScores).length > 0;
  const handleBack = useCallback(() => {
    if (hasPending) {
      Alert.alert('Unsaved Changes', 'You have unsaved scores. Save before leaving?', [
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        { text: 'Save & Exit', onPress: () => { triggerSave(); navigation.goBack(); } },
        { text: 'Stay', style: 'cancel' },
      ]);
    } else {
      navigation.goBack();
    }
  }, [hasPending, triggerSave, navigation]);

  // ─── Loading / error states ─────────────────────────────────────────────────

  const isLoading =
    loadingLog || loadingForm || loadingCategories || loadingScoreSettings || loadingScoreLogs;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading evaluation…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!displayForm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Unable to load evaluation form.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const completionPct = getCompletionPercentage(displayForm);
  const allScored = isFormComplete(displayForm);
  const scoredCount = displayForm.categories.reduce(
    (acc, c) => acc + c.attributes.filter((a) => a.currentScore !== undefined).length,
    0,
  );
  const totalCount = displayForm.categories.reduce((acc, c) => acc + c.attributes.length, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Sticky header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayForm.formName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {scoredCount} of {totalCount} scored
          </Text>
        </View>
        {/* progress pill */}
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>{Math.round(completionPct)}%</Text>
        </View>
      </View>

      {/* ── Category list ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {displayForm.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            isExpanded={expandedCategoryId === category.id}
            onToggle={() =>
              setExpandedCategoryId((prev) => (prev === category.id ? null : category.id))
            }
            onScoreAttribute={(attributeId, score, notes) =>
              handleScoreAttribute(category.id, attributeId, score, notes)
            }
            currentScores={Object.fromEntries(
              Object.entries(pendingScores).map(([k, v]) => [k, v]),
            )}
            disabled={!canScore}
          />
        ))}
        {/* bottom padding so content clears the sticky bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky bottom action bar ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarProgress}>
          <View style={[styles.progressBar, { width: `${completionPct}%` as any }]} />
        </View>
        <View style={styles.actionButtons}>
          <Button
            title="Save Progress"
            onPress={handleSaveProgress}
            variant="outline"
            size="md"
            loading={isSaving || saveScoreMutation.isPending}
            disabled={!hasPending}
            style={styles.saveBtn}
          />
          <Button
            title={allScored ? 'Complete & Submit' : `${scoredCount}/${totalCount} Scored`}
            onPress={handleCompleteAndSubmit}
            variant="primary"
            size="md"
            disabled={!allScored || !canScore}
            style={styles.submitBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    marginTop: 8,
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressPillText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 16,
  },
  actionBarProgress: {
    height: 3,
    backgroundColor: colors.gray100,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  saveBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 1.6,
  },
});
