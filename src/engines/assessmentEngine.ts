/**
 * assessmentEngine.ts
 * Assessment / quiz engine — manages quiz session state and result calculation.
 *
 * Provides pure functions that drive the quiz-taking UI: initialising a
 * session, recording answers, navigating between questions, and computing
 * final results.  All state transitions return new objects (immutable style).
 */

import type {
  BubbleQuiz,
  BubbleAssessmentQuestion,
  BubbleTestResult,
} from '@/types';

// ─── Quiz session state ───────────────────────────────────────────────────────

export interface QuizState {
  /** Bubble _id of the quiz being taken */
  quizId: string;
  /** Ordered question list for this session (may be shuffled) */
  questions: BubbleAssessmentQuestion[];
  /** 0-based index of the currently displayed question */
  currentIndex: number;
  /**
   * Map of questionId → the 0-based answer index the user selected.
   * Uses -1 as sentinel for "no answer yet" to distinguish from index 0.
   */
  answers: Record<string, number>;
  /** Timestamp the quiz session was created */
  startedAt: Date;
  /** Whether the user has submitted the quiz */
  isComplete: boolean;
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Creates a fresh QuizState for a given quiz + question set.
 *
 * If the quiz has Randomize Questions set, questions are shuffled using a
 * Fisher-Yates shuffle before being stored in state so navigation is
 * consistent across renders.
 */
export function initQuizState(
  quiz: BubbleQuiz,
  questions: BubbleAssessmentQuestion[],
): QuizState {
  let orderedQuestions: BubbleAssessmentQuestion[];

  if (quiz['Randomize Questions']) {
    orderedQuestions = shuffleArray([...questions]);
  } else {
    // Sort by Rank ascending (defensive copy)
    orderedQuestions = [...questions].sort((a, b) => a.Rank - b.Rank);
  }

  const initialAnswers: Record<string, number> = {};
  for (const q of orderedQuestions) {
    initialAnswers[q._id] = -1; // -1 = unanswered
  }

  return {
    quizId: quiz._id,
    questions: orderedQuestions,
    currentIndex: 0,
    answers: initialAnswers,
    startedAt: new Date(),
    isComplete: false,
  };
}

// ─── Answer recording ─────────────────────────────────────────────────────────

/**
 * Returns a new QuizState with the user's selected answer recorded.
 * If the quiz is already complete, the state is returned unchanged.
 *
 * @param state       Current quiz session state
 * @param questionId  Bubble _id of the question being answered
 * @param answerIndex 0-based index into the question's Answer Options array
 */
export function answerQuestion(
  state: QuizState,
  questionId: string,
  answerIndex: number,
): QuizState {
  if (state.isComplete) return state;

  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: answerIndex,
    },
  };
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Advances the session to the next question.
 * Has no effect if already on the last question.
 */
export function goToNext(state: QuizState): QuizState {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.questions.length) return state;
  return { ...state, currentIndex: nextIndex };
}

/**
 * Moves the session back to the previous question.
 * Has no effect if already on the first question.
 */
export function goToPrevious(state: QuizState): QuizState {
  const prevIndex = state.currentIndex - 1;
  if (prevIndex < 0) return state;
  return { ...state, currentIndex: prevIndex };
}

/**
 * Jumps directly to the question at the given index.
 * Ignores out-of-bounds indices.
 */
export function goToQuestion(state: QuizState, index: number): QuizState {
  if (index < 0 || index >= state.questions.length) return state;
  return { ...state, currentIndex: index };
}

// ─── Submission guard ─────────────────────────────────────────────────────────

/**
 * Returns true when every question in the session has a recorded answer
 * (i.e. no question has an answer of -1).
 */
export function canSubmit(state: QuizState): boolean {
  if (state.isComplete) return false;
  return state.questions.every((q) => (state.answers[q._id] ?? -1) >= 0);
}

/**
 * Returns the number of questions that still have no answer recorded.
 */
export function unansweredCount(state: QuizState): number {
  return state.questions.filter((q) => (state.answers[q._id] ?? -1) < 0).length;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface QuizScoreResult {
  /** Total points earned */
  score: number;
  /** Maximum points possible */
  total: number;
  /** Percentage (0–100), rounded to one decimal place */
  percentage: number;
  /** Whether the score meets or exceeds the quiz's Passing Score */
  passed: boolean;
}

/**
 * Calculates the final quiz score from a completed session.
 *
 * Each question contributes its .Points value when answered correctly.
 * Unanswered questions (-1) are counted as incorrect.
 *
 * The `quiz` parameter provides the Passing Score threshold.
 * The `questions` parameter must include hydrated Correct Answer Index values.
 */
export function calculateScore(
  state: QuizState,
  quiz: BubbleQuiz,
  questions: BubbleAssessmentQuestion[],
): QuizScoreResult {
  let earned = 0;
  let totalPoints = 0;

  for (const question of questions) {
    const pointValue = question.Points ?? 1;
    totalPoints += pointValue;

    const selectedIndex = state.answers[question._id] ?? -1;
    if (selectedIndex === question['Correct Answer Index']) {
      earned += pointValue;
    }
  }

  const percentage =
    totalPoints === 0 ? 0 : Math.round((earned / totalPoints) * 1000) / 10;

  return {
    score: earned,
    total: totalPoints,
    percentage,
    passed: earned >= quiz['Passing Score'],
  };
}

// ─── Test result builder ──────────────────────────────────────────────────────

/**
 * Constructs the Partial<BubbleTestResult> payload for persisting a quiz
 * attempt to Bubble.  The caller is responsible for POSTing this to the API.
 *
 * @param state           Completed quiz session
 * @param quiz            The quiz definition (for passing score + total points)
 * @param questions       Hydrated question list (for scoring)
 * @param userId          Bubble _id of the subject (trainee)
 * @param rosterId        Bubble _id of the BubbleProgramRoster entry
 * @param requirementId   Bubble _id of the BubblePhaseRequirement this satisfies
 * @param attemptNumber   The attempt number (1-based) for this subject/quiz
 */
export function buildTestResult(
  state: QuizState,
  quiz: BubbleQuiz,
  questions: BubbleAssessmentQuestion[],
  userId: string,
  rosterId: string,
  requirementId: string,
  attemptNumber: number,
): Partial<BubbleTestResult> {
  const { score, total, percentage, passed } = calculateScore(
    state,
    quiz,
    questions,
  );

  const submittedAt = new Date();
  const durationSeconds = Math.round(
    (submittedAt.getTime() - state.startedAt.getTime()) / 1000,
  );

  return {
    Quiz: state.quizId,
    Subject: userId,
    'Program Roster': rosterId,
    'Phase Requirement': requirementId,
    'Attempt Number': attemptNumber,
    'Answer Map': state.answers,
    'Score Earned': score,
    'Total Points': total,
    'Score Percent': percentage,
    Passed: passed,
    'Started At': state.startedAt.toISOString(),
    'Submitted At': submittedAt.toISOString(),
    'Duration Seconds': durationSeconds,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Returns true if the user has answered the question at the given index.
 */
export function isQuestionAnswered(state: QuizState, index: number): boolean {
  const question = state.questions[index];
  if (!question) return false;
  return (state.answers[question._id] ?? -1) >= 0;
}

/**
 * Returns the current question object, or undefined if the state has
 * no questions.
 */
export function getCurrentQuestion(
  state: QuizState,
): BubbleAssessmentQuestion | undefined {
  return state.questions[state.currentIndex];
}

/**
 * Returns whether the current question is the last in the session.
 */
export function isLastQuestion(state: QuizState): boolean {
  return state.currentIndex === state.questions.length - 1;
}

/**
 * Returns whether the current question is the first in the session.
 */
export function isFirstQuestion(state: QuizState): boolean {
  return state.currentIndex === 0;
}

/**
 * Returns a completed QuizState (isComplete = true).
 * Used after the user confirms submission.
 */
export function markComplete(state: QuizState): QuizState {
  return { ...state, isComplete: true };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Fisher-Yates shuffle — returns a new array, does not mutate input */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
