/**
 * permissionService.ts
 * Permission service — interprets Bubble data to determine access rights.
 *
 * All permission decisions are derived from the data returned by Bubble.
 * There is no hardcoded business logic about specific role names or field
 * values — all checks read from the Bubble objects themselves.
 *
 * This keeps the app in sync with permission model changes made in Bubble
 * without requiring a client app update.
 */

import type { BubbleUser, APExRole } from '../types/user';
import type {
  BubbleEvalFormSettings,
  BubbleEvalForm,
} from '../types/evalForm';
import type { BubbleEvalFormLog } from '../types/evalFormLog';
import type { BubbleFormWorkflowStep } from '../types/workflow';
import type { BubbleProgramRoster } from '../types/index';

// ─── Role Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all roles the user holds — primary role plus any additional roles.
 * Used for permission checks that require union role membership.
 */
function getAllRoles(user: BubbleUser): APExRole[] {
  const roles: APExRole[] = [];
  if (user['APEx Role']) roles.push(user['APEx Role']);
  if (user['APEx Roles']) {
    for (const r of user['APEx Roles']) {
      if (!roles.includes(r)) roles.push(r);
    }
  }
  return roles;
}

/**
 * Returns true if the user holds any of the specified roles.
 */
function userHasAnyRole(user: BubbleUser, roles: APExRole[]): boolean {
  const userRoles = getAllRoles(user);
  return roles.some((r) => userRoles.includes(r));
}

// ─── Eval Creation ────────────────────────────────────────────────────────────

/**
 * Returns true if the user is permitted to create a new evaluation
 * using the given form settings.
 *
 * Reads the 'Created By Roles' field from BubbleEvalFormSettings — this
 * field is managed in Bubble and defines which roles may initiate evals.
 * Falls back to checking if the user is an evaluator or admin if the field
 * is not configured.
 */
export function canCreateEval(
  user: BubbleUser,
  formSettings: BubbleEvalFormSettings,
): boolean {
  if (!user['APEx Access']) return false;

  // If Bubble has configured specific creator roles, check against those
  const allowedRoles: APExRole[] =
    (formSettings as unknown as { 'Created By Roles'?: APExRole[] })[
      'Created By Roles'
    ] ?? [];

  if (allowedRoles.length > 0) {
    return userHasAnyRole(user, allowedRoles);
  }

  // Default: evaluators and admins can create evals
  return userHasAnyRole(user, ['evaluator', 'admin']);
}

// ─── Score Editing ────────────────────────────────────────────────────────────

/**
 * Returns true if the user can edit/enter scores for the given eval log.
 *
 * Score editing is permitted when:
 *  1. The user is the evaluator on the log AND
 *  2. The eval is in an editable state (draft or in_progress) AND
 *  3. The user has the evaluator role (or admin)
 *
 * Reads form settings' 'Editable Roles' if available for finer control.
 */
export function canEditScores(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
): boolean {
  if (!user['APEx Access']) return false;

  const editableStatuses: BubbleEvalFormLog['Status'][] = [
    'draft',
    'in_progress',
  ];
  if (!editableStatuses.includes(formLog.Status)) return false;

  // Admin can always edit
  if (userHasAnyRole(user, ['admin'])) return true;

  // Must be the assigned evaluator
  return formLog.Evaluator === user._id;
}

// ─── Approval ────────────────────────────────────────────────────────────────

/**
 * Returns true if the user can approve the eval at the given workflow step.
 *
 * Reads the step's 'Reviewer Roles', 'Subject Must Action', and
 * 'Evaluator Must Action' fields from Bubble to determine who is allowed
 * to action this step.
 */
export function canApprove(
  user: BubbleUser,
  currentStep: BubbleFormWorkflowStep,
  formLog?: BubbleEvalFormLog,
): boolean {
  if (!user['APEx Access']) return false;

  // Check if this step requires the subject specifically
  if (currentStep['Subject Must Action']) {
    return formLog ? formLog.Subject === user._id : false;
  }

  // Check if this step requires the evaluator specifically
  if (currentStep['Evaluator Must Action']) {
    return formLog ? formLog.Evaluator === user._id : false;
  }

  // Otherwise check reviewer roles from the step definition
  const reviewerRoles = currentStep['Reviewer Roles'] ?? [];
  if (reviewerRoles.length > 0) {
    return userHasAnyRole(user, reviewerRoles);
  }

  // Default: admin can always approve
  return userHasAnyRole(user, ['admin']);
}

// ─── Dispute ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the user can dispute the given evaluation.
 *
 * Reads 'Allow Dispute' from BubbleEvalFormSettings and checks:
 *  1. Dispute is enabled on the form settings
 *  2. The user is the subject of the evaluation
 *  3. The eval is in an approvable/approved state (not already complete/archived)
 *  4. If a dispute window is configured, the eval was approved within the window
 */
export function canDispute(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
  formSettings: BubbleEvalFormSettings,
): boolean {
  if (!user['APEx Access']) return false;

  // Must have dispute enabled on this form
  if (!formSettings['Allow Dispute']) return false;

  // Only the subject can dispute their own evaluation
  if (formLog.Subject !== user._id) return false;

  // Can only dispute evals that have been approved (not draft/complete/archived)
  const disputeableStatuses: BubbleEvalFormLog['Status'][] = [
    'approved',
    'pending_review',
  ];
  if (!disputeableStatuses.includes(formLog.Status)) return false;

  // Check dispute window if configured
  const disputeWindowDays = formSettings['Dispute Window Days'];
  if (disputeWindowDays && disputeWindowDays > 0 && formLog['Approved At']) {
    const approvedAt = new Date(formLog['Approved At']);
    const windowExpiry = new Date(
      approvedAt.getTime() + disputeWindowDays * 24 * 60 * 60 * 1000,
    );
    if (new Date() > windowExpiry) return false;
  }

  return true;
}

// ─── Taskbook Access ──────────────────────────────────────────────────────────

/**
 * Returns true if the user can view the taskbook for the given roster entry.
 *
 * The subject can always view their own taskbook.
 * The assigned evaluator can view their subject's taskbook.
 * Reviewers and admins can view all taskbooks.
 */
export function canViewTaskbook(
  user: BubbleUser,
  roster: BubbleProgramRoster,
): boolean {
  if (!user['APEx Access']) return false;

  // Admin and reviewer can see all
  if (userHasAnyRole(user, ['admin', 'reviewer'])) return true;

  // Subject can see their own
  if (roster.Subject === user._id) return true;

  // Evaluator can see their assigned subjects
  if (roster.Evaluator === user._id) return true;

  return false;
}

// ─── Role Identification on an Eval ──────────────────────────────────────────

/**
 * Returns true if the user is the subject of the given evaluation.
 */
export function isSubject(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
): boolean {
  return formLog.Subject === user._id;
}

/**
 * Returns true if the user is the evaluator on the given evaluation.
 */
export function isEvaluator(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
): boolean {
  return formLog.Evaluator === user._id;
}

/**
 * Returns true if the user holds a reviewer or admin role.
 * Reviewers are not necessarily linked to specific evaluations.
 */
export function isReviewer(user: BubbleUser): boolean {
  return userHasAnyRole(user, ['reviewer', 'admin']);
}

// ─── Effective Role ───────────────────────────────────────────────────────────

/**
 * Returns the most contextually appropriate role for a user given an
 * optional evaluation form log.
 *
 * When a formLog is provided, the role is determined by the user's
 * relationship to that specific evaluation.
 *
 * When no formLog is provided, returns the user's primary APEx role.
 *
 * Priority (when formLog is present):
 *  1. admin (always admin)
 *  2. subject (if user is the eval subject)
 *  3. evaluator (if user is the eval evaluator)
 *  4. reviewer (if user holds reviewer role)
 *  5. primary APEx role as fallback
 */
export function getEffectiveRole(
  user: BubbleUser,
  formLog?: BubbleEvalFormLog,
): APExRole {
  const userRoles = getAllRoles(user);

  // Admin always gets admin context
  if (userRoles.includes('admin')) return 'admin';

  if (formLog) {
    // Check relationship to this specific eval
    if (formLog.Subject === user._id) return 'subject';
    if (formLog.Evaluator === user._id) return 'evaluator';
    if (userRoles.includes('reviewer')) return 'reviewer';
  }

  // Fall back to primary role
  return user['APEx Role'] ?? 'subject';
}

// ─── Self-Eval Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the user is permitted to create a self-evaluation using
 * the given form settings.
 */
export function canSelfEval(
  user: BubbleUser,
  formSettings: BubbleEvalFormSettings,
): boolean {
  if (!user['APEx Access']) return false;
  return formSettings['Allow Self Eval'] === true;
}

// ─── Score Visibility ────────────────────────────────────────────────────────

/**
 * Returns true if the user is permitted to see their own scores on a
 * completed evaluation.
 */
export function canViewOwnScores(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
  formSettings: BubbleEvalFormSettings,
): boolean {
  if (!user['APEx Access']) return false;

  // Admins and reviewers can always see scores
  if (userHasAnyRole(user, ['admin', 'reviewer'])) return true;

  // Evaluator can always see the scores they entered
  if (formLog.Evaluator === user._id) return true;

  // Subject visibility is controlled by form settings
  if (formLog.Subject === user._id) {
    return formSettings['Subject Can View Scores'] === true;
  }

  return false;
}
