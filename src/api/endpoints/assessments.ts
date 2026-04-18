/**
 * assessments.ts
 * Assessment and quiz API — fetches assessment definitions, quiz questions,
 * and manages test result submission and retrieval.
 */

import { get, post } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildConstraintsFromArray,
  buildSortParams,
  dataUrl,
  dataUrlById,
  type BubbleConstraint,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type {
  BubbleAssessment,
  BubbleQuiz,
  BubbleAssessmentQuestion,
  BubbleTestResult,
} from '../../types/assessment';

// ─── Assessment Definitions ───────────────────────────────────────────────────

/**
 * Fetches an assessment definition by ID.
 * Assessments are polymorphic wrappers around either an EvalForm (Is Form)
 * or a Quiz (Is Quiz).
 */
export async function getAssessment(id: string): Promise<BubbleAssessment> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.ASSESSMENT, id));
  return normalizeBubbleSingle<BubbleAssessment>(raw);
}

/**
 * Fetches all active assessments.
 * Optionally filter to quiz-type or form-type assessments.
 */
export async function getActiveAssessments(
  type?: 'quiz' | 'form',
): Promise<BubbleAssessment[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Active', constraint_type: 'equals', value: true },
  ];

  if (type === 'quiz') {
    constraints.push({ key: 'Is Quiz', constraint_type: 'equals', value: true });
  } else if (type === 'form') {
    constraints.push({ key: 'Is Form', constraint_type: 'equals', value: true });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Assessment Name', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.ASSESSMENT), { params });
  return normalizeBubbleList<BubbleAssessment>(raw).results;
}

// ─── Quiz Definitions ─────────────────────────────────────────────────────────

/**
 * Fetches a quiz definition by ID.
 * Quizzes hold the list of question references and scoring configuration.
 */
export async function getQuiz(id: string): Promise<BubbleQuiz> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.QUIZ, id));
  return normalizeBubbleSingle<BubbleQuiz>(raw);
}

// ─── Questions ────────────────────────────────────────────────────────────────

/**
 * Fetches all questions for a given quiz, sorted by Rank ascending.
 *
 * The 'Correct Answer Index' field is present on the Bubble record but
 * should only be shown to the user after they submit their answers.
 * Callers are responsible for not displaying this field during an active quiz.
 */
export async function getQuizQuestions(
  quizId: string,
): Promise<BubbleAssessmentQuestion[]> {
  const params = {
    constraints: buildConstraints({ Quiz: quizId }),
    ...buildSortParams('Rank', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.QUESTION_MC), { params });
  return normalizeBubbleList<BubbleAssessmentQuestion>(raw).results;
}

// ─── Test Results ─────────────────────────────────────────────────────────────

/**
 * Submits a completed quiz attempt to Bubble.
 *
 * The Answer Map is keyed by question _id, with the selected 0-based answer
 * index as the value. Example: { 'questionId1': 2, 'questionId2': 0 }
 *
 * Bubble's backend workflow calculates Score Earned, Score Percent, and Passed
 * fields after receiving the submission.
 */
export async function submitTestResult(
  data: Partial<BubbleTestResult>,
): Promise<BubbleTestResult> {
  if (!data['Quiz']) {
    throw new Error('Quiz ID is required to submit a test result');
  }
  if (!data['Subject']) {
    throw new Error('Subject ID is required to submit a test result');
  }
  if (!data['Answer Map']) {
    throw new Error('Answer Map is required to submit a test result');
  }

  const payload: Partial<BubbleTestResult> = {
    ...data,
    'Submitted At': data['Submitted At'] ?? new Date().toISOString(),
    'Started At': data['Started At'] ?? new Date().toISOString(),
  };

  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.TEST_RESULT), payload);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new TestResult');
  }

  const fetchedRaw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.TEST_RESULT, created.id),
  );
  return normalizeBubbleSingle<BubbleTestResult>(fetchedRaw);
}

/**
 * Fetches test results for a given subject (trainee).
 * Optionally filters to results for a specific quiz.
 *
 * Results are sorted newest first so the most recent attempt appears first.
 */
export async function getTestResults(
  userId: string,
  quizId?: string,
): Promise<BubbleTestResult[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: userId },
  ];

  if (quizId) {
    constraints.push({
      key: 'Quiz',
      constraint_type: 'equals',
      value: quizId,
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Submitted At', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TEST_RESULT), { params });
  return normalizeBubbleList<BubbleTestResult>(raw).results;
}

/**
 * Fetches the most recent test result for a subject on a specific quiz.
 * Returns null if the subject has not yet attempted the quiz.
 */
export async function getLatestTestResult(
  userId: string,
  quizId: string,
): Promise<BubbleTestResult | null> {
  const results = await getTestResults(userId, quizId);
  return results.length > 0 ? results[0] : null;
}

/**
 * Returns the number of attempts a subject has made on a specific quiz.
 * Used to enforce attempt limits before allowing another submission.
 */
export async function getAttemptCount(
  userId: string,
  quizId: string,
): Promise<number> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: userId },
    { key: 'Quiz', constraint_type: 'equals', value: quizId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TEST_RESULT), { params });
  const list = normalizeBubbleList<BubbleTestResult>(raw);
  return list.count;
}

/**
 * Returns true if the subject can make another attempt at the quiz,
 * based on the quiz's Max Attempts setting and their current attempt count.
 */
export async function canAttemptQuiz(
  userId: string,
  quiz: BubbleQuiz,
): Promise<boolean> {
  // 0 means unlimited attempts
  if (quiz['Max Attempts'] === 0) return true;

  const attemptCount = await getAttemptCount(userId, quiz._id);
  return attemptCount < quiz['Max Attempts'];
}
