/**
 * userLog.ts
 * Types for the audit log system — tracking user actions and system events
 * within APEx360.
 *
 * BubbleUserLog records are created by Bubble backend workflows whenever a
 * significant action occurs.  They form the immutable audit trail for
 * compliance and operational review.
 */

// ---------------------------------------------------------------------------
// Log action union
// ---------------------------------------------------------------------------

/**
 * All auditable actions that produce a BubbleUserLog entry.
 *
 * Naming convention: <entity>_<verb>
 */
export type LogAction =
  // Authentication
  | 'auth_login'
  | 'auth_logout'
  | 'auth_password_reset'
  | 'auth_token_refresh'

  // Evaluation form log actions
  | 'eval_created'
  | 'eval_started'
  | 'eval_saved'           // Draft auto-save or manual save
  | 'eval_submitted'       // Evaluator submits for review
  | 'eval_approved'        // Workflow step approved
  | 'eval_disputed'        // Subject or reviewer disputes
  | 'eval_returned'        // Reviewer returns to evaluator
  | 'eval_completed'       // Final terminal state reached
  | 'eval_archived'
  | 'eval_score_updated'   // Individual attribute score changed
  | 'eval_acknowledged'    // Subject acknowledges/views the completed eval

  // Workflow actions
  | 'workflow_step_actioned'
  | 'workflow_completed'

  // Taskbook actions
  | 'task_completed'
  | 'task_cosigned'
  | 'task_uncompleted'     // Reversal/correction

  // Quiz / assessment actions
  | 'quiz_started'
  | 'quiz_submitted'
  | 'quiz_passed'
  | 'quiz_failed'

  // Progress note actions
  | 'note_created'
  | 'note_edited'
  | 'note_deleted'
  | 'note_acknowledged'    // Subject acknowledges a visible note

  // Roster actions
  | 'roster_enrolled'
  | 'roster_phase_advanced'
  | 'roster_phase_returned' // Trainee moved back to a prior phase
  | 'roster_completed'
  | 'roster_terminated'

  // Program / form admin actions
  | 'program_created'
  | 'program_updated'
  | 'form_created'
  | 'form_updated'

  // User account actions
  | 'user_role_changed'
  | 'user_access_granted'
  | 'user_access_revoked'

  // Generic / catch-all
  | 'system_event'
  | 'other';

// ---------------------------------------------------------------------------
// User log record
// ---------------------------------------------------------------------------

/**
 * An immutable audit log entry representing a single system or user action.
 * Maps to the "User Logs" data type in Bubble.
 */
export interface BubbleUserLog {
  _id: string;
  /**
   * The auditable action that occurred.
   * Drives icon, color, and display label in audit log views.
   */
  Action: LogAction;
  /**
   * Free-text audit description of what happened.
   * Written by the Bubble backend workflow — not user-editable.
   * Example: "Evaluator John Smith submitted eval #EV-2024-0412 for review."
   */
  Audit: string;
  /**
   * Bubble _id of the BubbleUser who performed the action.
   * May be null for system-generated events.
   */
  'Completed By'?: string;
  /**
   * Whether this log entry relates to an evaluation event.
   * When true, Eval Ref will be populated.
   */
  'Is Eval': boolean;
  /**
   * Bubble _id of the BubbleEvalFormLog this log entry relates to.
   * Populated when Is Eval is true.
   */
  'Eval Ref'?: string;
  /**
   * Whether this log entry's detail panel should default to expanded
   * in list views.  Set to true for high-priority or dispute-related entries.
   */
  Expanded: boolean;
  /**
   * Structured JSON content for machine-readable details.
   * Schema varies by Action type.  Examples:
   *   - For eval_score_updated: { attributeId, oldScore, newScore }
   *   - For roster_phase_advanced: { fromPhaseId, toPhaseId }
   *   - For auth_login: { ipAddress, userAgent }
   *
   * Stored as a JSON string in Bubble; parsed on the client.
   */
  Content?: Record<string, unknown>;
  /**
   * Bubble _id of the BubbleUser the action was performed *on behalf of*
   * or *about* (the subject of the action, if different from Completed By).
   */
  'Target User'?: string;
  /**
   * Generic entity reference — Bubble _id of the primary record
   * affected by this action (e.g. eval log _id, roster _id, task log _id).
   */
  'Entity Ref'?: string;
  /**
   * Entity type string for the Entity Ref above.
   * Example values: "EvalFormLog", "ProgramRoster", "TaskbookLog"
   */
  'Entity Type'?: string;
  created_date?: string;
  modified_date?: string;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Maps a LogAction to a human-readable display label for the audit log UI.
 */
export const logActionLabels: Partial<Record<LogAction, string>> = {
  auth_login: 'Signed In',
  auth_logout: 'Signed Out',
  eval_created: 'Evaluation Created',
  eval_submitted: 'Evaluation Submitted',
  eval_approved: 'Evaluation Approved',
  eval_disputed: 'Evaluation Disputed',
  eval_returned: 'Evaluation Returned',
  eval_completed: 'Evaluation Completed',
  eval_acknowledged: 'Evaluation Acknowledged',
  task_completed: 'Task Completed',
  task_cosigned: 'Task Co-signed',
  quiz_submitted: 'Quiz Submitted',
  quiz_passed: 'Quiz Passed',
  quiz_failed: 'Quiz Failed',
  note_created: 'Progress Note Created',
  roster_enrolled: 'Enrolled in Program',
  roster_phase_advanced: 'Phase Advanced',
  roster_completed: 'Program Completed',
  roster_terminated: 'Program Terminated',
  user_role_changed: 'Role Changed',
  user_access_granted: 'Access Granted',
  user_access_revoked: 'Access Revoked',
};
