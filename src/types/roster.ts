/**
 * roster.ts
 * Types for program roster management — tracking trainees/interns through
 * structured training phases in APEx360.
 */

// ---------------------------------------------------------------------------
// Phase requirement type
// ---------------------------------------------------------------------------

/**
 * Discriminates what kind of activity a BubblePhaseRequirement points to.
 */
export type TaskRequirementType =
  | 'task'            // A BubbleTask checklist item (hands-on skill or task)
  | 'skill'           // A dedicated skills verification item
  | 'assessment_form' // A scored evaluation form (BubbleEvalForm)
  | 'assessment_quiz' // A knowledge quiz (BubbleQuiz)
  | 'assignment';     // A Canvas assignment or general deliverable

// ---------------------------------------------------------------------------
// Phase requirement
// ---------------------------------------------------------------------------

/**
 * A single requirement within a training phase.
 * Maps to the "Program Phase Requirements" data type in Bubble.
 *
 * Each requirement points to exactly one of: task, assessment form, or quiz.
 * The boolean flags determine how it is rendered and tracked.
 */
export interface BubblePhaseRequirement {
  _id: string;
  /** Display label for this requirement */
  'Requirement Name': string;
  /** Optional description shown to trainees */
  Description?: string;
  /** Which kind of activity this requirement represents */
  Type: TaskRequirementType;
  /** Display order within the phase (1-based) */
  Rank: number;
  /**
   * When true this requirement involves a hands-on task checklist entry.
   * Mutually exclusive with Assessment Form / Quiz flags.
   */
  'Is Task': boolean;
  /**
   * When true this is a skills verification item (subset of task).
   */
  'Is Skill': boolean;
  /**
   * When true the trainee must complete a scored evaluation form.
   */
  'Is Assessment Form': boolean;
  /**
   * When true the trainee must pass a quiz.
   */
  'Is Assessment Quiz': boolean;
  /**
   * When true this is a Canvas or similar external assignment.
   */
  'Is Assignment': boolean;
  /**
   * Bubble _id of the BubbleTask this requirement points to.
   * Populated when Is Task or Is Skill is true.
   */
  'Task Ref'?: string;
  /**
   * Bubble _id of the BubbleEvalForm this requirement points to.
   * Populated when Is Assessment Form is true.
   */
  'Assessment Form Ref'?: string;
  /**
   * Bubble _id of the BubbleQuiz this requirement points to.
   * Populated when Is Assessment Quiz is true.
   */
  'Assessment Quiz Ref'?: string;
  /**
   * Bubble _id of the BubbleAssessment this requirement points to.
   * Used when a single Assessment record wraps either a form or quiz.
   */
  'Assessment Ref'?: string;
  /**
   * How many times this requirement must be completed to satisfy the phase.
   * Defaults to 1 for most requirement types.
   */
  'Required Count': number;
  /** Whether completion of this requirement earns points toward phase total */
  'Earns Points': boolean;
  /** Point value when Earns Points is true */
  Points?: number;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Program phase
// ---------------------------------------------------------------------------

/**
 * A structured phase within a training program (e.g. "Phase 1: Orientation").
 * Maps to the "Program Phases" data type in Bubble.
 */
export interface BubbleProgramPhase {
  _id: string;
  /** Phase title (e.g. "Phase 2: Advanced Field Training") */
  'Phase Name': string;
  /** Optional description shown to trainees and trainers */
  Description?: string;
  /** Display order within the parent program (1-based) */
  Rank: number;
  /** Bubble _id of the parent BubbleProgram */
  Program: string;
  /**
   * Minimum average evaluation score required to advance beyond this phase.
   * Expressed as a value on the form's score scale (e.g. 3.0 on a 5-point scale).
   * Null means no score gate for advancement.
   */
  'Min Average Score'?: number;
  /**
   * Minimum number of calendar days a trainee must spend in this phase
   * before advancement is considered, regardless of requirement completion.
   */
  'Min Duration Days'?: number;
  /**
   * Ordered list of BubblePhaseRequirement _ids that must be completed
   * to satisfy this phase.
   */
  'Requirements List': string[];
  /** Hydrated requirement objects */
  Requirements?: BubblePhaseRequirement[];
  /**
   * Minimum number of evaluation form logs that must reach 'approved' status
   * within this phase before the trainee can advance.
   */
  'Min Eval Count'?: number;
  /**
   * Bubble _ids of specific BubbleEvalForm templates that must be completed
   * in this phase (in addition to the general min eval count).
   */
  'Required Eval Forms'?: string[];
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

/**
 * A training program definition (e.g. "Paramedic Field Internship").
 * Maps to the "Programs" data type in Bubble.
 */
export interface BubbleProgram {
  _id: string;
  /** Program name shown throughout the app */
  'Program Name': string;
  /** Full description of the program */
  Description?: string;
  /** Whether this program is available for new roster entries */
  Active: boolean;
  /** Ordered list of BubbleProgramPhase _ids */
  'Phases List': string[];
  /** Hydrated phase objects */
  Phases?: BubbleProgramPhase[];
  /** Bubble _ids of organizations this program is available to */
  Organizations?: string[];
  /** Total minimum duration in days across all phases */
  'Total Min Duration Days'?: number;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Program roster entry
// ---------------------------------------------------------------------------

/**
 * An individual trainee's enrollment in a program.
 * Maps to the "Program Roster" data type in Bubble.
 *
 * One roster entry exists per trainee per program enrollment.
 */
export interface BubbleProgramRoster {
  _id: string;
  /** Bubble _id of the enrolled trainee (BubbleUser) */
  Subject: string;
  /** Bubble _id of the BubbleProgram */
  Program: string;
  /** Bubble _id of the BubbleProgramPhase the trainee is currently in */
  'Current Phase': string;
  /**
   * Bubble _id of the primary assigned trainer/FTO (BubbleUser).
   * May change across phases.
   */
  'Assigned Trainer'?: string;
  /**
   * Bubble _ids of any additional trainers assigned to this roster entry.
   */
  'Additional Trainers'?: string[];
  /** ISO 8601 date the trainee started the program */
  'Start Date': string;
  /**
   * ISO 8601 date the trainee is expected to complete the program.
   * Calculated from start date + total minimum duration, or set manually.
   */
  'Expected End Date'?: string;
  /**
   * ISO 8601 date the trainee actually completed or was separated from
   * the program.  Null if still active.
   */
  'End Date'?: string;
  /**
   * All BubbleEvalFormLog _ids associated with this roster entry,
   * across all phases.
   */
  'Eval Logs': string[];
  /**
   * Computed count of approved evaluations in the current phase.
   * Maintained by Bubble workflows.
   */
  'Current Phase Eval Count'?: number;
  /**
   * Computed average score for the current phase across all approved evals.
   */
  'Current Phase Average Score'?: number;
  /** Whether the roster entry is currently active */
  Active: boolean;
  /** Reason for program termination if the trainee did not complete */
  'Termination Reason'?: string;
  created_date?: string;
  modified_date?: string;
}
