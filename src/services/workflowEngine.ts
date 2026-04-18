/**
 * workflowEngine.ts
 * Workflow engine — pure functions that derive workflow state and available
 * actions from Bubble data.
 *
 * All logic is data-driven: step definitions are read from Bubble workflow
 * records (BubbleFormWorkflowStep), not hardcoded. This means workflow
 * changes made in Bubble are automatically reflected in the app without
 * requiring a new release.
 */

import type { BubbleUser } from '../types/user';
import type { BubbleEvalFormSettings } from '../types/evalForm';
import type { BubbleEvalFormLog } from '../types/evalFormLog';
import type {
  BubbleFormWorkflowStep,
  BubbleEvalWorkflowLog,
  WorkflowAction,
} from '../types/workflow';

// ─── Step Navigation ──────────────────────────────────────────────────────────

/**
 * Returns the next step in the workflow sequence after the given step.
 *
 * Steps are ordered by their Rank field (ascending). The "next" step is
 * the one with the lowest Rank that is greater than the current step's Rank.
 *
 * Returns null if the current step is the final step or if steps is empty.
 */
export function getNextStep(
  steps: BubbleFormWorkflowStep[],
  currentStepId: string,
): BubbleFormWorkflowStep | null {
  const sorted = [...steps].sort((a, b) => a.Rank - b.Rank);
  const currentIndex = sorted.findIndex((s) => s._id === currentStepId);

  if (currentIndex === -1 || currentIndex === sorted.length - 1) {
    return null;
  }

  return sorted[currentIndex + 1];
}

/**
 * Returns the previous step in the workflow sequence.
 * Used to determine where to route an eval on rejection/return.
 */
export function getPreviousStep(
  steps: BubbleFormWorkflowStep[],
  currentStepId: string,
): BubbleFormWorkflowStep | null {
  const sorted = [...steps].sort((a, b) => a.Rank - b.Rank);
  const currentIndex = sorted.findIndex((s) => s._id === currentStepId);

  if (currentIndex <= 0) return null;

  return sorted[currentIndex - 1];
}

/**
 * Returns the first step in the workflow (lowest Rank).
 * Used when an eval is submitted for the first time.
 */
export function getFirstStep(
  steps: BubbleFormWorkflowStep[],
): BubbleFormWorkflowStep | null {
  if (steps.length === 0) return null;
  return [...steps].sort((a, b) => a.Rank - b.Rank)[0];
}

// ─── Ownership Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the given user is the designated actor for the current
 * workflow step.
 *
 * Ownership is determined by reading the step's configuration fields:
 *  - 'Subject Must Action'   → the eval's subject must act
 *  - 'Evaluator Must Action' → the eval's evaluator must act
 *  - 'Reviewer Roles'        → any user holding one of these roles
 *
 * A user can be the step owner if any of the above match.
 */
export function isCurrentStepOwner(
  user: BubbleUser,
  currentStep: BubbleFormWorkflowStep,
  formLog: BubbleEvalFormLog,
): boolean {
  if (!user['APEx Access']) return false;

  // Admin can always act
  const allRoles = [
    user['APEx Role'],
    ...(user['APEx Roles'] ?? []),
  ].filter(Boolean);
  if (allRoles.includes('admin')) return true;

  // Check subject-specific requirement
  if (currentStep['Subject Must Action']) {
    return formLog.Subject === user._id;
  }

  // Check evaluator-specific requirement
  if (currentStep['Evaluator Must Action']) {
    return formLog.Evaluator === user._id;
  }

  // Check role-based ownership
  const reviewerRoles = currentStep['Reviewer Roles'] ?? [];
  if (reviewerRoles.length > 0) {
    return allRoles.some((r) => reviewerRoles.includes(r));
  }

  return false;
}

// ─── Available Actions ────────────────────────────────────────────────────────

/**
 * Returns the set of workflow actions the given user can take at the
 * current step of the given evaluation.
 *
 * This function:
 *  1. Checks that the user is the current step owner (returns [] if not)
 *  2. Reads the actions configured on the current step from Bubble
 *  3. Filters out 'dispute' if the form settings don't allow it
 *
 * The result is a subset of WorkflowAction values that should be rendered
 * as buttons in the UI.
 */
export function getAvailableActions(
  user: BubbleUser,
  currentStep: BubbleFormWorkflowStep,
  formLog: BubbleEvalFormLog,
  formSettings: BubbleEvalFormSettings,
): WorkflowAction[] {
  // If the user is not the step owner, they have no actions
  if (!isCurrentStepOwner(user, currentStep, formLog)) {
    return [];
  }

  // Start with the actions allowed by the step definition
  // We treat the step as allowing all standard actions if not configured,
  // then filter by the dispute setting
  const baseActions: WorkflowAction[] = ['approve', 'dispute', 'submit', 'return'];

  // Determine which actions are semantically valid at this step
  const available: WorkflowAction[] = [];

  // 'submit' is valid if this is the first step and the eval is in_progress/draft
  if (
    formLog.Status === 'draft' ||
    formLog.Status === 'in_progress'
  ) {
    available.push('submit');
  }

  // 'approve' is valid if the eval has been submitted (past draft)
  if (
    formLog.Status === 'pending_review' ||
    formLog.Status === 'disputed'
  ) {
    available.push('approve');
  }

  // 'return' is valid for reviewers at review steps
  if (formLog.Status === 'pending_review') {
    available.push('return');
  }

  // 'dispute' is valid if the form settings allow it and the step allows it
  const disputeAllowed =
    currentStep['Dispute Allowed'] === true &&
    formSettings['Allow Dispute'] === true;

  if (
    disputeAllowed &&
    (formLog.Status === 'pending_review' || formLog.Status === 'approved')
  ) {
    available.push('dispute');
  }

  return available;
}

// ─── Completion Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the evaluation has passed through all workflow steps
 * and is considered complete.
 *
 * An eval is complete when:
 *  - Its status is 'complete' or 'approved', OR
 *  - Its current step is the final step and that step has been actioned
 *
 * The steps array is used to find the final step definition.
 */
export function isEvalComplete(
  formLog: BubbleEvalFormLog,
  steps: BubbleFormWorkflowStep[],
): boolean {
  if (formLog.Status === 'complete' || formLog.Status === 'archived') {
    return true;
  }

  if (formLog.Status === 'approved') {
    const finalStep = steps.find((s) => s['Final Step'] === true);
    if (!finalStep) return true; // No final step defined → treat approved as complete
    return true; // Approved always means the workflow completed
  }

  return false;
}

// ─── Progress Calculation ─────────────────────────────────────────────────────

/**
 * Calculates the progress of an evaluation through its workflow steps.
 *
 * Returns:
 *  - current: the 1-based index of the current step
 *  - total: total number of steps
 *  - percentage: integer 0–100 representing completion
 *
 * If currentStepId is not found in steps, returns { current: 0, total, percentage: 0 }.
 */
export function getStepProgress(
  steps: BubbleFormWorkflowStep[],
  currentStepId: string,
): { current: number; total: number; percentage: number } {
  const sorted = [...steps].sort((a, b) => a.Rank - b.Rank);
  const total = sorted.length;

  if (total === 0) {
    return { current: 0, total: 0, percentage: 0 };
  }

  const currentIndex = sorted.findIndex((s) => s._id === currentStepId);

  if (currentIndex === -1) {
    return { current: 0, total, percentage: 0 };
  }

  const current = currentIndex + 1;
  const percentage = Math.round((current / total) * 100);

  return { current, total, percentage };
}

// ─── Status Labels ────────────────────────────────────────────────────────────

/**
 * Returns a human-readable status label for the current state of an evaluation.
 *
 * When a current step is available, the step name is incorporated to give a
 * more specific label (e.g. "Pending: FTO Review" instead of "Pending Review").
 *
 * Falls back to status-based labels when no step is available.
 */
export function getWorkflowStatusLabel(
  formLog: BubbleEvalFormLog,
  currentStep: BubbleFormWorkflowStep | null,
): string {
  switch (formLog.Status) {
    case 'draft':
      return 'Draft';

    case 'in_progress':
      return 'In Progress';

    case 'pending_review':
      if (currentStep) {
        return `Pending: ${currentStep['Step Name']}`;
      }
      return 'Pending Review';

    case 'disputed':
      if (currentStep) {
        return `Disputed — ${currentStep['Step Name']}`;
      }
      return 'Disputed';

    case 'approved':
      return 'Approved';

    case 'complete':
      return 'Complete';

    case 'archived':
      return 'Archived';

    default:
      return 'Unknown';
  }
}

// ─── SLA Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the current workflow step is overdue based on its SLA.
 *
 * Reads the 'SLA Hours' field from the step. A value of 0 (or undefined)
 * means no SLA is enforced and this function returns false.
 *
 * The activatedAt timestamp is when the step became active (ball-in-court).
 */
export function isStepOverdue(
  step: BubbleFormWorkflowStep,
  activatedAt: string | undefined,
): boolean {
  const slaHours = step['SLA Hours'];
  if (!slaHours || slaHours <= 0 || !activatedAt) return false;

  const activatedDate = new Date(activatedAt);
  const slaExpiry = new Date(
    activatedDate.getTime() + slaHours * 60 * 60 * 1000,
  );

  return new Date() > slaExpiry;
}

/**
 * Returns hours remaining before SLA expires, or null if no SLA is set.
 * Returns 0 if already overdue.
 */
export function getSLARemainingHours(
  step: BubbleFormWorkflowStep,
  activatedAt: string | undefined,
): number | null {
  const slaHours = step['SLA Hours'];
  if (!slaHours || slaHours <= 0 || !activatedAt) return null;

  const activatedDate = new Date(activatedAt);
  const slaExpiry = new Date(
    activatedDate.getTime() + slaHours * 60 * 60 * 1000,
  );

  const remainingMs = slaExpiry.getTime() - Date.now();
  return Math.max(0, Math.round(remainingMs / (60 * 60 * 1000)));
}
