/**
 * evalForm.ts
 * Types for APEx Evaluation Form definitions stored in Bubble.io.
 *
 * These are the *template* data types — they describe the structure of an
 * evaluation but contain no runtime score data.  Runtime data lives in
 * evalFormLog.ts.
 */

// ---------------------------------------------------------------------------
// Score scale
// ---------------------------------------------------------------------------

/**
 * A single score level within a 1–5 scale.
 * Bubble stores five of these per EvalScoreSettings record.
 */
export interface BubbleEvalScoreLevel {
  /** Display name for this score value (e.g. "Exceeds Standard") */
  name: string;
  /**
   * Hex color code used to render the score chip/badge.
   * Overrides the app default scoreDefault color from the theme.
   */
  color: string;
  /**
   * When true, the evaluator must provide written feedback before the
   * form can be submitted with this score value.
   */
  feedbackRequired: boolean;
}

/**
 * The score settings record attached to an EvalForm.
 * Defines the 1–5 label/color/feedback-required mapping.
 */
export interface BubbleEvalScoreSettings {
  _id: string;
  /** Display label for the scale overall (e.g. "Standard 5-Point Scale") */
  'Scale Name': string;
  /** Score value 1 definition — typically the lowest/failing score */
  'Value1 Name': string;
  'Value1 Color': string;
  'Value1 Feedback Required': boolean;
  /** Score value 2 definition */
  'Value2 Name': string;
  'Value2 Color': string;
  'Value2 Feedback Required': boolean;
  /** Score value 3 definition */
  'Value3 Name': string;
  'Value3 Color': string;
  'Value3 Feedback Required': boolean;
  /** Score value 4 definition */
  'Value4 Name': string;
  'Value4 Color': string;
  'Value4 Feedback Required': boolean;
  /** Score value 5 definition — typically the highest/exemplary score */
  'Value5 Name': string;
  'Value5 Color': string;
  'Value5 Feedback Required': boolean;
  created_date?: string;
  modified_date?: string;
}

/**
 * Converts a BubbleEvalScoreSettings record into an ordered array of
 * BubbleEvalScoreLevel for easy iteration in UI components.
 */
export function scoreSettingsToLevels(
  settings: BubbleEvalScoreSettings,
): BubbleEvalScoreLevel[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    name: settings[`Value${n} Name` as keyof BubbleEvalScoreSettings] as string,
    color: settings[`Value${n} Color` as keyof BubbleEvalScoreSettings] as string,
    feedbackRequired: settings[
      `Value${n} Feedback Required` as keyof BubbleEvalScoreSettings
    ] as boolean,
  }));
}

// ---------------------------------------------------------------------------
// Eval Category Attributes
// ---------------------------------------------------------------------------

/**
 * An individual scored item within a category.
 * Maps to the "Eval Category Attributes" data type in Bubble.
 */
export interface BubbleEvalCategoryAttribute {
  _id: string;
  /** The attribute label shown to evaluators (e.g. "Scene Safety Assessment") */
  'Attribute Name': string;
  /** Optional longer description shown below the label */
  Description?: string;
  /** Rank within its parent category (1-based, ascending) */
  Rank: number;
  /** When true this attribute is excluded from average score calculations */
  'Exclude from Score'?: boolean;
  /** Optional override score settings for this specific attribute */
  'Score Settings'?: string; // Bubble _id ref
  /** Whether evaluator feedback/comments are always required */
  'Comments Required'?: boolean;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Eval Categories
// ---------------------------------------------------------------------------

/**
 * A grouping of scored attributes within an Evaluation Form.
 * Maps to the "Eval Categories" data type in Bubble.
 */
export interface BubbleEvalCategory {
  _id: string;
  /** Category title (e.g. "Patient Assessment", "Medical Decision Making") */
  'Category Name': string;
  /** Optional description shown as a sub-header */
  Description?: string;
  /** Ordered list of attribute _ids belonging to this category */
  'Attributes List': string[];
  /**
   * The hydrated attribute objects — populated when fetching a full form
   * definition with expanded relations.
   */
  Attributes?: BubbleEvalCategoryAttribute[];
  /** Display order within the parent form (1-based) */
  Rank: number;
  /** Bubble _id of the parent EvalForm */
  'Eval Form': string;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Eval Form Settings
// ---------------------------------------------------------------------------

/**
 * Configuration settings attached to an Evaluation Form.
 * Controls behavior, visibility, and workflow assignment.
 */
export interface BubbleEvalFormSettings {
  _id: string;
  /** Bubble _id of the associated workflow template */
  'Form Workflow'?: string;
  /** Bubble _id of the score scale to use by default */
  'Score Settings'?: string;
  /** Whether subjects can see their own scores after evaluation is complete */
  'Subject Can View Scores': boolean;
  /** Whether subjects can dispute an approved evaluation */
  'Allow Dispute': boolean;
  /**
   * Number of days after approval that a dispute can be raised.
   * Null means disputes are always allowed while Allow Dispute is true.
   */
  'Dispute Window Days'?: number;
  /** Whether evaluators must add an overall comment before submitting */
  'Overall Comment Required': boolean;
  /** Whether a passing average score is required for form submission */
  'Require Passing Score': boolean;
  /** Minimum average score required to submit (only relevant if Require Passing Score is true) */
  'Minimum Passing Score'?: number;
  /** Whether the form can be used for self-evaluation by the subject */
  'Allow Self Eval': boolean;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Eval Form (top-level template)
// ---------------------------------------------------------------------------

/**
 * An Evaluation Form definition.
 * Maps to the "Evaluation Forms" data type in Bubble.
 *
 * A form is a reusable template containing categories and attributes.
 * It is instantiated at runtime as a BubbleEvalFormLog.
 */
export interface BubbleEvalForm {
  _id: string;
  /** Human-readable form name (e.g. "Advanced Airway Management Evaluation") */
  'Form Name': string;
  /** Optional description shown on the form detail screen */
  Description?: string;
  /** Version identifier — allows tracking changes to a form over time */
  Version?: string;
  /** Whether this form is available for new evaluations */
  Active: boolean;
  /** Bubble _id refs for the categories belonging to this form, in display order */
  'Categories List': string[];
  /**
   * Hydrated category objects — populated when fetching a full form definition.
   */
  Categories?: BubbleEvalCategory[];
  /** Bubble _id of the EvalFormSettings record controlling this form's behavior */
  'Form Settings'?: string;
  /**
   * Hydrated settings — populated with the related EvalFormSettings record
   * when fetching full form details.
   */
  Settings?: BubbleEvalFormSettings;
  /** Bubble _id of the default EvalScoreSettings to use for all attributes */
  'Score Settings'?: string;
  /** Hydrated score settings */
  ScoreSettings?: BubbleEvalScoreSettings;
  /** Bubble _ids of organizations that can use this form */
  'Organizations'?: string[];
  /** ISO 8601 creation timestamp */
  created_date?: string;
  modified_date?: string;
}
