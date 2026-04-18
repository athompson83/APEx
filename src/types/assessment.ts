/**
 * assessment.ts
 * Types for the assessment and quiz system in APEx360.
 *
 * Assessments may be either scored evaluation forms (BubbleEvalForm) or
 * multiple-choice quizzes (BubbleQuiz).  A BubbleAssessment record acts as a
 * wrapper that disambiguates which kind of assessment a phase requirement
 * points to.
 */

// ---------------------------------------------------------------------------
// Quiz question
// ---------------------------------------------------------------------------

/**
 * A single multiple-choice question within a BubbleQuiz.
 * Maps to the "Assessment Questions" data type in Bubble.
 */
export interface BubbleAssessmentQuestion {
  _id: string;
  /** Bubble _id of the parent BubbleQuiz */
  Quiz: string;
  /** The question text presented to the user */
  'Question Text': string;
  /**
   * Optional image URL to display alongside the question
   * (e.g. an ECG strip, anatomical diagram).
   */
  'Question Image'?: string;
  /** Display order within the quiz (1-based) */
  Rank: number;
  /** The full list of answer choices (typically 4 options) */
  'Answer Options': string[];
  /**
   * The 0-based index into Answer Options that is the correct answer.
   * Not transmitted to clients until after submission to prevent cheating.
   */
  'Correct Answer Index': number;
  /**
   * Explanation shown to the user after they submit their answer
   * (in review mode or after quiz completion).
   */
  Explanation?: string;
  /** Point value of this question (default 1) */
  Points: number;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Quiz definition
// ---------------------------------------------------------------------------

/**
 * A knowledge quiz composed of multiple-choice questions.
 * Maps to the "Quizzes" data type in Bubble.
 */
export interface BubbleQuiz {
  _id: string;
  /** Quiz title displayed to trainees */
  'Quiz Name': string;
  /** Optional description or instructions shown before the quiz begins */
  Description?: string;
  /** Whether this quiz is active and assignable to phase requirements */
  Active: boolean;
  /** Ordered list of BubbleAssessmentQuestion _ids */
  'Questions List': string[];
  /** Hydrated question objects (populated on detail fetch) */
  Questions?: BubbleAssessmentQuestion[];
  /** Total possible points (sum of all question point values) */
  'Total Points': number;
  /**
   * Minimum score (in points) required to pass the quiz.
   * Used to auto-mark a BubbleTestResult as passing.
   */
  'Passing Score': number;
  /**
   * Maximum number of attempts allowed per trainee.
   * 0 = unlimited attempts.
   */
  'Max Attempts': number;
  /**
   * Time limit in minutes for completing the quiz.
   * 0 = no time limit.
   */
  'Time Limit Minutes': number;
  /**
   * Whether questions should be presented in random order.
   */
  'Randomize Questions': boolean;
  /**
   * Whether answer options should be shuffled per question.
   */
  'Randomize Answers': boolean;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Assessment wrapper
// ---------------------------------------------------------------------------

/**
 * A polymorphic wrapper record that a BubblePhaseRequirement references
 * when the requirement type is assessment_form or assessment_quiz.
 * Maps to the "Assessments" data type in Bubble.
 *
 * Exactly one of Form Ref or Quiz Ref will be populated.
 */
export interface BubbleAssessment {
  _id: string;
  /** Human-readable name (may mirror the form or quiz name) */
  'Assessment Name': string;
  /** Whether this assessment is of quiz type */
  'Is Quiz': boolean;
  /** Whether this assessment is of evaluation-form type */
  'Is Form': boolean;
  /**
   * Bubble _id of the BubbleEvalForm this assessment wraps.
   * Populated when Is Form is true.
   */
  'Form Ref'?: string;
  /**
   * Bubble _id of the BubbleQuiz this assessment wraps.
   * Populated when Is Quiz is true.
   */
  'Quiz Ref'?: string;
  /** Whether this assessment is active and assignable */
  Active: boolean;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Quiz test result
// ---------------------------------------------------------------------------

/**
 * A completed quiz attempt record.
 * Maps to the "Test Results" data type in Bubble.
 *
 * Created when a trainee submits a BubbleQuiz.
 */
export interface BubbleTestResult {
  _id: string;
  /** Bubble _id of the BubbleQuiz that was taken */
  Quiz: string;
  /** Bubble _id of the BubbleUser (trainee) who took the quiz */
  Subject: string;
  /** Bubble _id of the BubbleProgramRoster entry (if within a program) */
  'Program Roster'?: string;
  /** Bubble _id of the BubblePhaseRequirement this attempt satisfies */
  'Phase Requirement'?: string;
  /** Attempt number for this subject/quiz combination (1-based) */
  'Attempt Number': number;
  /**
   * Map of question _id → selected answer index (the user's choices).
   * Stored as a JSON string in Bubble; parsed on the client.
   */
  'Answer Map': Record<string, number>;
  /** Total points earned across all questions */
  'Score Earned': number;
  /** Total possible points (snapshot from quiz at time of attempt) */
  'Total Points': number;
  /**
   * Percentage score (0–100), computed as Score Earned / Total Points × 100.
   */
  'Score Percent': number;
  /**
   * Whether this attempt met or exceeded the quiz's Passing Score.
   */
  Passed: boolean;
  /** ISO 8601 date/time when the quiz was started */
  'Started At': string;
  /** ISO 8601 date/time when the quiz was submitted */
  'Submitted At': string;
  /**
   * Time taken in seconds (Submitted At - Started At).
   * Computed by Bubble backend workflow on submission.
   */
  'Duration Seconds'?: number;
  created_date?: string;
  modified_date?: string;
}
