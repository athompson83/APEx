/**
 * workflow.ts
 * Types for the approval workflow engine that governs evaluation sign-off
 * chains in APEx360.
 *
 * A BubbleFormWorkflow contains an ordered list of BubbleFormWorkflowStep
 * records.  When an evaluation is submitted, a BubbleEvalWorkflowLog is
 * created to track which steps have been actioned and by whom.
 */

import { APExRole } from './user';

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------

/**
 * The set of actions a user can take on an evaluation at a given workflow step.
 *
 * - approve   : Advance the evaluation to the next step (or complete it if final)
 * - dispute   : Flag the evaluation as disputed — routes back for re-evaluation
 * - submit    : Evaluator submits a draft/in-progress evaluation for review
 * - return    : Reviewer returns the evaluation to the evaluator for corrections
 *               without fully disputing it
 */
export type WorkflowAction = 'approve' | 'dispute' | 'submit' | 'return';

// ---------------------------------------------------------------------------
// Workflow template
// ---------------------------------------------------------------------------

/**
 * A reusable workflow template defining the approval chain for an EvalForm.
 * Maps to the "Form Workflows" data type in Bubble.
 */
export interface BubbleFormWorkflow {
  _id: string;
  /** Human-readable workflow name (e.g. "Standard Field Training Review") */
  'Workflow Name': string;
  /** Optional description of when/why this workflow is used */
  Description?: string;
  /** Whether this workflow is available to be assigned to new forms */
  Active: boolean;
  /** Ordered list of BubbleFormWorkflowStep _ids (ascending by Rank) */
  'Steps List': string[];
  /**
   * Hydrated step objects — populated when fetching a workflow with
   * expanded relations.
   */
  Steps?: BubbleFormWorkflowStep[];
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Workflow step template
// ---------------------------------------------------------------------------

/**
 * A single step in a workflow approval chain.
 * Maps to the "Form Workflow Steps" data type in Bubble.
 */
export interface BubbleFormWorkflowStep {
  _id: string;
  /** Bubble _id of the parent BubbleFormWorkflow */
  'Form Workflow': string;
  /** Step label shown in the UI (e.g. "Field Training Officer Review") */
  'Step Name': string;
  /** Display order — steps are processed in ascending rank order */
  Rank: number;
  /**
   * Which APEx roles are permitted to action this step.
   * Any user holding one of these roles (and associated with the eval)
   * can approve/dispute.
   */
  'Reviewer Roles': APExRole[];
  /**
   * When true, the evaluation's Subject must action this step
   * (e.g. acknowledgement or counter-signature).
   */
  'Subject Must Action': boolean;
  /**
   * When true, the evaluation's Evaluator must action this step
   * (e.g. a self-sign-off before sending to a supervisor).
   */
  'Evaluator Must Action': boolean;
  /**
   * When true, this is the terminal approval step.
   * Approving at this step moves the evaluation to 'approved' status.
   */
  'Final Step': boolean;
  /**
   * When true, actioning this step with 'approve' sets the evaluation
   * to 'approved'.  Typically mirrors Final Step but can differ when
   * post-approval steps (e.g. archiving) exist.
   */
  'Marks Approved': boolean;
  /**
   * When true, actioning this step with 'dispute' is permitted.
   * Not all steps allow disputes (e.g. a final archive step).
   */
  'Dispute Allowed': boolean;
  /**
   * Optional instruction text shown to the actioning user at this step.
   */
  Instructions?: string;
  /** Number of hours before this step is considered overdue (0 = no SLA) */
  'SLA Hours'?: number;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Runtime workflow log
// ---------------------------------------------------------------------------

/**
 * Status of a single step within a running workflow log.
 */
export type WorkflowStepStatus =
  | 'pending'    // Not yet reached
  | 'active'     // Currently awaiting action
  | 'approved'   // Actioned with approve
  | 'disputed'   // Actioned with dispute
  | 'returned'   // Actioned with return
  | 'skipped';   // Bypassed by system logic

/**
 * Records the status and actor for one step in a running workflow.
 */
export interface BubbleWorkflowStepLog {
  _id: string;
  /** Bubble _id of the parent BubbleEvalWorkflowLog */
  'Workflow Log': string;
  /** Bubble _id of the BubbleFormWorkflowStep template */
  'Workflow Step': string;
  /** Current status of this step */
  Status: WorkflowStepStatus;
  /** Bubble _id of the user who actioned this step (null if still pending) */
  'Actioned By'?: string;
  /** The action the user took */
  Action?: WorkflowAction;
  /** Optional comment left by the actioning user */
  Comment?: string;
  /** ISO 8601 timestamp when this step was actioned */
  'Actioned At'?: string;
  /** ISO 8601 timestamp when this step became active (SLA start) */
  'Activated At'?: string;
  created_date?: string;
  modified_date?: string;
}

/**
 * The runtime workflow log tracking an evaluation's progress through
 * its approval chain.
 * Maps to the "Eval Workflow Logs" data type in Bubble.
 */
export interface BubbleEvalWorkflowLog {
  _id: string;
  /** Bubble _id of the associated BubbleEvalFormLog */
  'Eval Log': string;
  /** Bubble _id of the BubbleFormWorkflow template being executed */
  'Form Workflow': string;
  /**
   * Bubble _id of the BubbleFormWorkflowStep currently awaiting action.
   * Null when the workflow is complete or not yet started.
   */
  'Current Step': string | null;
  /** Ordered list of BubbleWorkflowStepLog _ids */
  'Step Logs': string[];
  /** Hydrated step log objects */
  StepLogs?: BubbleWorkflowStepLog[];
  /** Whether the workflow has reached its terminal state */
  Complete: boolean;
  /** ISO 8601 timestamp when the workflow was initiated (eval first submitted) */
  'Started At'?: string;
  /** ISO 8601 timestamp when the workflow reached its final state */
  'Completed At'?: string;
  created_date?: string;
  modified_date?: string;
}
