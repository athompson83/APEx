/**
 * QuizScreen.tsx
 * Multiple-choice quiz taking screen driven by assessmentEngine.
 * Handles navigation between questions, answer selection, and submission.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useAudit } from '@/hooks/useAudit';
import { getQuiz, getQuizQuestions, submitTestResult } from '@/api/endpoints/assessments';
import { markTaskComplete, createTaskbookLog } from '@/api/endpoints/taskbook';
import {
  initQuizState,
  answerQuestion,
  goToNext,
  goToPrevious,
  canSubmit,
  calculateScore,
  buildTestResult,
} from '@/engines/assessmentEngine';
import type { QuizScreenProps } from '@/navigation/types';

export default function QuizScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<QuizScreenProps['route']>();
  const { quizId, requirementId, rosterId } = route.params;

  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const { logAssessmentSubmitted } = useAudit();

  const [quizState, setQuizState] = useState<ReturnType<typeof initQuizState> | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ReturnType<typeof calculateScore> | null>(null);

  const { data: quiz, isLoading: loadingQuiz } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
  });

  const { data: questions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['quizQuestions', quizId],
    queryFn: () => getQuizQuestions(quizId),
    enabled: !!quizId,
    onSuccess: (qs) => {
      if (quiz) setQuizState(initQuizState(quiz, qs));
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!quizState || !user) throw new Error('Missing state');
      const score = calculateScore(quizState, questions);
      const resultData = buildTestResult(quizState, user._id, rosterId, requirementId);
      await submitTestResult(resultData);
      if (score.passed) {
        await createTaskbookLog({
          Intern: user._id,
          Requirement: requirementId,
          Phase: '',
          Program: '',
          'Attempt Number': 1,
          Success: true,
          'Completed By': user._id,
        });
      }
      await logAssessmentSubmitted(quizId);
      return score;
    },
    onSuccess: (score) => {
      setResults(score);
      setShowResults(true);
    },
    onError: () => addToast('Failed to submit quiz', 'error'),
  });

  const handleAnswer = useCallback(
    (questionId: string, answerId: string) => {
      if (!quizState) return;
      setQuizState(answerQuestion(quizState, questionId, answerId));
    },
    [quizState],
  );

  const handleSubmit = useCallback(() => {
    if (!quizState || !canSubmit(quizState)) return;
    Alert.alert('Submit Quiz', `Submit all ${questions.length} answers?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: () => submitMutation.mutate() },
    ]);
  }, [quizState, questions.length, submitMutation]);

  const isLoading = loadingQuiz || loadingQuestions;

  if (isLoading || !quizState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <InlineLoader size="large" />
      </SafeAreaView>
    );
  }

  // ── Results view ──────────────────────────────────────────────────────────
  if (showResults && results) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quiz Complete</Text>
        </View>
        <View style={styles.resultsContainer}>
          <Ionicons
            name={results.passed ? 'checkmark-circle' : 'close-circle'}
            size={64}
            color={results.passed ? colors.success : colors.danger}
          />
          <Text style={styles.resultsScore}>
            {results.score} / {results.total}
          </Text>
          <Text style={styles.resultsPct}>{Math.round(results.percentage)}%</Text>
          <Text style={[styles.resultsStatus, { color: results.passed ? colors.success : colors.danger }]}>
            {results.passed ? 'Passed' : 'Not Passed'}
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            variant="primary"
            size="lg"
            style={{ marginTop: 32, width: 200 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz view ─────────────────────────────────────────────────────────────
  const currentQuestion = questions[quizState.currentIndex];
  const selectedAnswer = quizState.answers[currentQuestion?._id ?? ''];
  const progress = ((quizState.currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Quit Quiz', 'Your progress will be lost.', [
              { text: 'Stay', style: 'cancel' },
              { text: 'Quit', style: 'destructive', onPress: () => navigation.goBack() },
            ])
          }
          style={styles.backBtn}
        >
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Question {quizState.currentIndex + 1} of {questions.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
      </View>

      <ScrollView contentContainerStyle={styles.quizContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion?.Question}</Text>
        </Card>

        {(currentQuestion?.Answers ?? []).map((answer: any) => {
          const isSelected = selectedAnswer === answer._id;
          return (
            <TouchableOpacity
              key={answer._id}
              onPress={() => handleAnswer(currentQuestion._id, answer._id)}
              style={[styles.answerOption, isSelected && styles.answerSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={[styles.answerRadio, isSelected && styles.answerRadioSelected]}>
                {isSelected && <View style={styles.answerRadioDot} />}
              </View>
              <Text style={[styles.answerText, isSelected && styles.answerTextSelected]}>
                {answer.Answer}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.navBar}>
        <Button
          title="Previous"
          onPress={() => setQuizState(goToPrevious(quizState))}
          variant="outline"
          size="md"
          disabled={quizState.currentIndex === 0}
          style={styles.navBtn}
        />
        {quizState.currentIndex < questions.length - 1 ? (
          <Button
            title="Next"
            onPress={() => setQuizState(goToNext(quizState))}
            variant="primary"
            size="md"
            style={styles.navBtn}
          />
        ) : (
          <Button
            title="Submit"
            onPress={handleSubmit}
            variant="primary"
            size="md"
            disabled={!canSubmit(quizState)}
            loading={submitMutation.isPending}
            style={styles.navBtn}
          />
        )}
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
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  progressTrack: { height: 4, backgroundColor: colors.gray100 },
  progressFill: { height: 4, backgroundColor: colors.accent },
  quizContent: { padding: 16, gap: 12 },
  questionCard: { marginBottom: 8 },
  questionText: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, lineHeight: 26 },
  answerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  answerSelected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  answerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerRadioSelected: { borderColor: colors.primary },
  answerRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  answerText: { flex: 1, fontSize: 15, color: colors.textPrimary },
  answerTextSelected: { fontWeight: '600', color: colors.primary },
  navBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navBtn: { flex: 1 },
  resultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  resultsScore: { fontSize: 48, fontWeight: '800', color: colors.textPrimary, marginTop: 16 },
  resultsPct: { fontSize: 22, color: colors.textSecondary },
  resultsStatus: { fontSize: 18, fontWeight: '700', marginTop: 8 },
});
