/**
 * evalFormLog.ts
 * Runtime evaluation instance types — the "filled-in" version of an EvalForm.
 *
 * A BubbleEvalFormLog is created when an evaluator starts an evaluation
 * against a subject for a specific form template.  BubbleEvalScoreLog records
 * hold the individual attribute scores captured during that session.
 */

// ---------------------------------------------------------------------------
// Status union
// ---------------------------------------------------------------------------

/**
 * All possible lifecycle states of an evaluation form log.
 *
 * State machine (simplified):
 *   draft → in_progress → pending_review → approved | disputed
 *   disputed → in_progress (re-evaluation)
 *   approved → complete → archived
 */
export type EvalStatus =
  | 'draft'           // Created but not yet started
  | 'in_progress'     // Actively being scored by evaluator
  | 'pending_review'  // Submitted by evaluator, awaiting workflow approval
  | 'approved'        // Passed the full workflow
  | 'disputed'        // Subject has contested the evaluation
  | 'complete'        // Fully finalized — no further changes allowed
  | 'archived';       // Removed from active views but retained for records

// ---------------------------------------------------------------------------
// Individual attribute score record
// ---------------------------------------------------------------------------

/**
 * A single scored attribute within a running evaluation.
 * Maps to the "Eval Score Log" data type in Bubble.
 *
 * One BubbleEvalScoreLog is created per BubbleEvalCategoryAttribute when
 * an evaluator scores the form.
 */
export interface BubbleEvalScoreLog {
  _id: string;
  /** Bubble _id of the parent EvalFormLog */
  'Eval Log': string;
  /** Bubble _id of the EvalCategory this attribute belongs to */
  'Eval Category': string;
  /** Bubble _id of the EvalCategoryAttribute being scored */
  'Eval Attribute': string;
  /**
   * Numeric score value (1–5 corresponding to the form's scale).
   * Null if the attribute has not yet been scored.
   */
  Score: number | null;
  /** Evaluator-provided comment or feedback for this attribute */
  Comments?: string;
  /**
   * When true the evaluator flagged this attribute as Not Applicable.
   * NA attributes are excluded from score average calculations.
   */
  'Not Applicable': boolean;
  /**
   * Whether this score was overridden during a dispute/review phase.
   * Useful for audit displays.
   */
  'Score Overridden'?: boolean;
  /** Bubble _id of the reviewer who overrode the score, if applicable */
  'Overridden By'?: string;
  /** ISO 8601 timestamp of when the score was last updated */
  'Scored At'?: string;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Core evaluation instance
// ---------------------------------------------------------------------------

/**
 * A runtime instance of an Evaluation Form — the record created when
 * an evaluator evaluates a subject.
 * Maps to the "Eval Form Log" data type in Bubble.
 */
export interface BubbleEvalFormLog {
  _id: string;
  /** Bubble _id of the EvalForm template this log is based on */
  'Eval Form': string;
  /** Current lifecycle state */
  Status: EvalStatus;
  /** Bubble _id of the user being evaluated */
  Subject: string;
  /** Bubble _id of the user performing the evaluation */
  Evaluator: string;
  /**
   * Bubble _id of the ProgramRoster entry, if this evaluation is
   * associated with a training program.
   */
  'Program Roster'?: string;
  /**
   * Bubble _id of the BubbleProgramPhase, if this evaluation fulfills
   * a phase requirement.
   */
  'Program Phase'?: string;
  /**
   * Bubble _id of the BubblePhaseRequirement this evaluation satisfies.
   */
  'Phase Requirement'?: string;
  /** Bubble _ids of all BubbleEvalScoreLog records for this evaluation */
  'Score Logs': string[];
  /**
   * Hydrated score log objects — populated when fetching a detailed view.
   */
  ScoreLogs?: BubbleEvalScoreLog[];
  /**
   * Computed average score across all non-NA, non-excluded attributes.
   * Populated by a Bubble backend workflow after all scores are submitted.
   */
  'Average Score'?: number;
  /** Evaluator's overall summary comments for the full evaluation */
  'Overall Comments'?: string;
  /**
   * Subject's written response to the evaluation — provided if the subject
   * exercises the dispute option.
   */
  'Subject Response'?: string;
  /** ISO 8601 date/time the evaluation was started */
  'Started At'?: string;
  /** ISO 8601 date/time the evaluation was submitted for review */
  'Submitted At'?: string;
  /** ISO 8601 date/time the evaluation reached 'approved' status */
  'Approved At'?: string;
  /** ISO 8601 date/time the evaluation was completed (final state) */
  'Completed At'?: string;
  /**
   * Whether the subject has acknowledged (viewed) the evaluation.
   * Becomes true once the subject opens the completed evaluation in the app.
   */
  'Subject Acknowledged': boolean;
  /** ISO 8601 date/time the subject first acknowledged the evaluation */
  'Acknowledged At'?: string;
  /**
   * Bubble _id of the current active workflow step this log is awaiting.
   * Null when draft/complete/archived.
   */
  'Current Workflow Step'?: string;
  /** Bubble _id of the EvalWorkflowLog tracking approval chain progress */
  'Workflow Log'?: string;
  /** Related shift — Bubble _id of a BubbleShiftSchedule record */
  'Related Shift'?: string;
  /** Free-text incident or call reference number */
  'Call Reference'?: string;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Computed / derived helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the evaluation is in a state where the evaluator
 * can still edit scores.
 */
export function isEvalEditable(status: EvalStatus): boolean {
  return status === 'draft' || status === 'in_progress';
}

/**
 * Returns true if the evaluation has reached a terminal state.
 */
export function isEvalTerminal(status: EvalStatus): boolean {
  return status === 'complete' || status === 'archived';
}

/**
 * Maps an EvalStatus to a human-readable display label.
 */
export const evalStatusLabels: Record<EvalStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  approved: 'Approved',
  disputed: 'Disputed',
  complete: 'Complete',
  archived: 'Archived',
};
