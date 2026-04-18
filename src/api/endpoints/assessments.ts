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
} from '../../types/index';

// ─── Assessment Definitions ───────────────────────────────────────────────────

/**
 * Fetches an assessment definition by ID.
 * Assessments are higher-level containers that reference a quiz and define
 * passing thresholds and attempt limits.
 */
export async function getAssessment(id: string): Promise<BubbleAssessment> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.ASSESSMENT, id));
  return normalizeBubbleSingle<BubbleAssessment>(raw);
}

/**
 * Fetches all active assessments for a given program phase.
 */
export async function getAssessmentsByPhase(
  phaseId: string,
): Promise<BubbleAssessment[]> {
  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Program Phase', constraint_type: 'equals', value: phaseId },
      { key: 'Is Active', constraint_type: 'equals', value: true },
    ]),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.ASSESSMENT), { params });
  return normalizeBubbleList<BubbleAssessment>(raw).results;
}

// ─── Quiz Definitions ─────────────────────────────────────────────────────────

/**
 * Fetches a quiz definition by ID.
 * Quizzes hold the list of question references and display settings.
 */
export async function getQuiz(id: string): Promise<BubbleQuiz> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.QUIZ, id));
  return normalizeBubbleSingle<BubbleQuiz>(raw);
}

// ─── Questions ────────────────────────────────────────────────────────────────

/**
 * Fetches all questions for a given quiz, sorted by Order ascending.
 *
 * Questions are multiple-choice. The correct answer is stored on the
 * server and NOT returned to the client until after submission to prevent
 * cheating — this function only retrieves the question text and options.
 */
export async function getQuizQuestions(
  quizId: string,
): Promise<BubbleAssessmentQuestion[]> {
  const params = {
    constraints: buildConstraints({ Quiz: quizId }),
    ...buildSortParams('Order', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.QUESTION_MC), { params });
  const questions = normalizeBubbleList<BubbleAssessmentQuestion>(raw).results;

  // Strip the correct answer from client-side data so it can't be inspected
  // The answer will be included in server response after submission
  return questions.map((q) => ({
    ...q,
    'Correct Answer': undefined as unknown as 'A' | 'B' | 'C' | 'D',
  }));
}

/**
 * Fetches quiz questions including correct answers. Only call this
 * after a test has been submitted (for showing results/explanations).
 */
export async function getQuizQuestionsWithAnswers(
  quizId: string,
): Promise<BubbleAssessmentQuestion[]> {
  const params = {
    constraints: buildConstraints({ Quiz: quizId }),
    ...buildSortParams('Order', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.QUESTION_MC), { params });
  return normalizeBubbleList<BubbleAssessmentQuestion>(raw).results;
}

// ─── Test Results ─────────────────────────────────────────────────────────────

/**
 * Submits a completed test result to Bubble.
 *
 * The answers map is keyed by question ID, with the selected answer letter
 * as the value (e.g. { 'questionId123': 'B', 'questionId456': 'A' }).
 *
 * Bubble's backend workflow calculates the score, compares against the
 * assessment's passing threshold, and sets the Passed field.
 */
export async function submitTestResult(
  data: Partial<BubbleTestResult>,
): Promise<BubbleTestResult> {
  if (!data['Quiz']) {
    throw new Error('Quiz ID is required to submit a test result');
  }
  if (!data['User']) {
    throw new Error('User ID is required to submit a test result');
  }
  if (!data['Answers']) {
    throw new Error('Answers are required to submit a test result');
  }

  const payload: Partial<BubbleTestResult> = {
    ...data,
    'Submitted Date': data['Submitted Date'] ?? new Date().toISOString(),
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
 * Fetches test results for a given user.
 * Optionally filters to results for a specific quiz.
 *
 * Results are sorted newest first so the most recent attempt appears first.
 */
export async function getTestResults(
  userId: string,
  quizId?: string,
): Promise<BubbleTestResult[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'User', constraint_type: 'equals', value: userId },
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
    ...buildSortParams('Submitted Date', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TEST_RESULT), { params });
  return normalizeBubbleList<BubbleTestResult>(raw).results;
}

/**
 * Fetches the most recent test result for a user on a specific quiz.
 * Returns null if the user has not yet attempted the quiz.
 */
export async function getLatestTestResult(
  userId: string,
  quizId: string,
): Promise<BubbleTestResult | null> {
  const results = await getTestResults(userId, quizId);
  return results.length > 0 ? results[0] : null;
}

/**
 * Counts how many attempts a user has made on a specific quiz.
 * Used to enforce attempt limits before allowing another submission.
 */
export async function getAttemptCount(
  userId: string,
  quizId: string,
): Promise<number> {
  const constraints: BubbleConstraint[] = [
    { key: 'User', constraint_type: 'equals', value: userId },
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
