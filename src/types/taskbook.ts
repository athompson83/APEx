/**
 * taskbook.ts
 * Types for the task and skill checklist system used within training phases.
 *
 * Tasks are discrete activities (hands-on procedures, skills demonstrations)
 * that trainees must complete as part of a BubbleProgramPhase.  Each attempt
 * is logged as a BubbleTaskbookLog.
 */

// ---------------------------------------------------------------------------
// Requirement type discriminator (re-exported for convenience)
// ---------------------------------------------------------------------------

/**
 * Discriminates the kind of activity a BubblePhaseRequirement or
 * BubbleTaskbookLog entry represents.
 */
export type TaskRequirementType =
  | 'task'            // A general procedural checklist item
  | 'skill'           // A specific psychomotor skill demonstration
  | 'assessment_form' // A scored evaluation form
  | 'assessment_quiz' // A knowledge quiz
  | 'assignment';     // An external or Canvas assignment

// ---------------------------------------------------------------------------
// Task definition
// ---------------------------------------------------------------------------

/**
 * A reusable task or skill definition.
 * Maps to the "Tasks" data type in Bubble.
 *
 * Tasks are referenced by BubblePhaseRequirement records and logged via
 * BubbleTaskbookLog when completed.
 */
export interface BubbleTask {
  _id: string;
  /** Short name displayed in checklists and requirement lists */
  'Task Name': string;
  /** Detailed description of what is expected for completion */
  Description?: string;
  /**
   * When true this task is classified as a psychomotor skills verification,
   * which may require a different sign-off workflow than a general task.
   */
  'Is Skill': boolean;
  /**
   * URL to an external reference resource (e.g. a protocol page, training video).
   */
  'Reference Link'?: string;
  /**
   * Bubble file URL for an attached reference document (PDF, image, etc.).
   */
  'Reference File'?: string;
  /**
   * When true, a supervisor or trainer with evaluator-level access must
   * co-sign the completion log.
   */
  'Requires Cosign': boolean;
  /**
   * Optional list of prerequisite BubbleTask _ids that should be completed
   * before this task.  Enforced at the UI level as a suggestion, not a gate.
   */
  Prerequisites?: string[];
  /** Whether this task definition is active and available for assignment */
  Active: boolean;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Task completion log
// ---------------------------------------------------------------------------

/**
 * A record of one attempt to complete a task or skill requirement.
 * Maps to the "Taskbook Logs" data type in Bubble.
 *
 * Multiple logs may exist for the same requirement if:
 *   - The requirement allows multiple attempts
 *   - The trainee needed to repeat the task for competency
 */
export interface BubbleTaskbookLog {
  _id: string;
  /**
   * Bubble _id of the BubbleUser (trainee/intern) who completed the task.
   */
  'Intern User': string;
  /**
   * Bubble _id of the BubbleProgramPhase in which this task was completed.
   */
  Phase: string;
  /**
   * Bubble _id of the BubbleProgram this log is associated with.
   */
  Program: string;
  /**
   * Bubble _id of the BubblePhaseRequirement this log satisfies.
   */
  Requirement: string;
  /**
   * Bubble _id of the specific BubbleTask or BubbleEvalForm or BubbleQuiz
   * this log is recording completion for.
   */
  'Task Ref'?: string;
  /**
   * Sequential attempt number for this requirement (1 = first attempt).
   * Useful for requirements that can be retried.
   */
  'Attempt Number': number;
  /**
   * Whether this attempt was successful / marked complete.
   * False = attempted but not yet passed; True = requirement satisfied.
   */
  Success: boolean;
  /**
   * Bubble _id of the BubbleUser (trainer/evaluator) who verified/signed-off
   * on this completion.  May be the same as Intern User for self-reported tasks
   * that do not require cosign.
   */
  'Completed By': string;
  /**
   * ISO 8601 date/time the task was completed or attempted.
   */
  'Completed At': string;
  /** Optional notes about the attempt — entered by the completing/cosigning user */
  Notes?: string;
  /**
   * Whether a cosign is still pending for this log entry.
   * True only when the task requires cosign and none has been provided yet.
   */
  'Cosign Pending': boolean;
  /**
   * Bubble _id of the BubbleUser who cosigned this log (if applicable).
   */
  'Cosigned By'?: string;
  /** ISO 8601 date/time the cosign was provided */
  'Cosigned At'?: string;
  created_date?: string;
  modified_date?: string;
}
