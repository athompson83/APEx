/**
 * permissionService.ts
 * Permission service — interprets Bubble data to determine access rights.
 *
 * All permission decisions are derived from fields on Bubble objects returned
 * by the API. No hardcoded business logic or role names exist here — all
 * checks read from the actual data so that permission model changes made in
 * Bubble are automatically reflected without a client app update.
 */

import type { BubbleUser, APExRole } from '../types/user';
import type {
  BubbleEvalFormSettings,
} from '../types/evalForm';
import type { BubbleEvalFormLog } from '../types/evalFormLog';
import type { BubbleFormWorkflowStep } from '../types/workflow';
import type { BubbleProgramRoster } from '../types/roster';

// ─── Role Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all roles the user holds — primary role plus any additional roles.
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
 * Reads the 'Created By Roles' field from BubbleEvalFormSettings when
 * available, falling back to checking evaluator/admin roles.
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
 *  1. The eval is in an editable state (draft or in_progress)
 *  2. The user is the assigned evaluator OR is an admin
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
 * Returns true if the user can approve/action the eval at the current step.
 *
 * Reads the step's 'Reviewer Roles', 'Subject Must Action', and
 * 'Evaluator Must Action' fields from Bubble.
 */
export function canApprove(
  user: BubbleUser,
  currentStep: BubbleFormWorkflowStep,
  formLog?: BubbleEvalFormLog,
): boolean {
  if (!user['APEx Access']) return false;

  // Admin can always act
  if (userHasAnyRole(user, ['admin'])) return true;

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

  return false;
}

// ─── Dispute ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the user can dispute the given evaluation.
 *
 * Reads 'Allow Dispute' from BubbleEvalFormSettings and checks:
 *  1. Dispute is enabled on the form settings
 *  2. The user is the subject of the evaluation
 *  3. The eval is in an approvable/approved state
 *  4. The dispute window has not expired (if 'Dispute Window Days' is set)
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

  // Can only dispute evals in review or approved state
  const disputeableStatuses: BubbleEvalFormLog['Status'][] = [
    'approved',
    'pending_review',
  ];
  if (!disputeableStatuses.includes(formLog.Status)) return false;

  // Check dispute window if configured
  const disputeWindowDays = formSettings['Dispute Window Days'];
  if (
    disputeWindowDays &&
    disputeWindowDays > 0 &&
    formLog['Approved At']
  ) {
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
 * Access rules:
 *  - Subject: can always see their own taskbook
 *  - Assigned Trainer: can see their trainee's taskbook
 *  - Additional Trainers: can see the taskbook (checked via field list)
 *  - Reviewer / Admin: universal access
 */
export function canViewTaskbook(
  user: BubbleUser,
  roster: BubbleProgramRoster,
): boolean {
  if (!user['APEx Access']) return false;

  // Admin and reviewer see all
  if (userHasAnyRole(user, ['admin', 'reviewer'])) return true;

  // Subject sees their own
  if (roster.Subject === user._id) return true;

  // Assigned trainer sees their trainee
  if (roster['Assigned Trainer'] === user._id) return true;

  // Additional trainers see the trainee
  const additionalTrainers = roster['Additional Trainers'] ?? [];
  if (additionalTrainers.includes(user._id)) return true;

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
 */
export function isReviewer(user: BubbleUser): boolean {
  return userHasAnyRole(user, ['reviewer', 'admin']);
}

// ─── Effective Role ───────────────────────────────────────────────────────────

/**
 * Returns the most contextually appropriate role for the user given an
 * optional evaluation form log.
 *
 * Priority (when formLog is present):
 *  1. admin (always admin regardless of context)
 *  2. subject (user is the eval's subject)
 *  3. evaluator (user is the eval's evaluator)
 *  4. reviewer (user holds reviewer role)
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
    if (formLog.Subject === user._id) return 'subject';
    if (formLog.Evaluator === user._id) return 'evaluator';
    if (userRoles.includes('reviewer')) return 'reviewer';
  }

  return user['APEx Role'] ?? 'subject';
}

// ─── Self-Eval Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the user is permitted to create a self-evaluation
 * based on the form settings.
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
 * Returns true if the user is permitted to see scores on the given evaluation.
 *
 * Admins and reviewers always have access. Evaluators see the scores they
 * entered. Subject visibility is controlled by 'Subject Can View Scores'
 * in the form settings.
 */
export function canViewOwnScores(
  user: BubbleUser,
  formLog: BubbleEvalFormLog,
  formSettings: BubbleEvalFormSettings,
): boolean {
  if (!user['APEx Access']) return false;

  if (userHasAnyRole(user, ['admin', 'reviewer'])) return true;
  if (formLog.Evaluator === user._id) return true;

  if (formLog.Subject === user._id) {
    return formSettings['Subject Can View Scores'] === true;
  }

  return false;
}
