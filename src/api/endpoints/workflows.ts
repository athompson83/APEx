/**
 * workflows.ts
 * Workflow API — fetches workflow step definitions and runtime workflow logs,
 * and submits workflow actions via Bubble backend workflows.
 */

import { get } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildSortParams,
  buildConstraintsFromArray,
  callWorkflow,
  dataUrl,
  dataUrlById,
  type BubbleConstraint,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type {
  BubbleFormWorkflowStep,
  BubbleEvalWorkflowLog,
} from '../../types/workflow';
import type { WorkflowAction } from '../../types/workflow';

// ─── Workflow Step Definitions ────────────────────────────────────────────────

/**
 * Fetches all steps belonging to a given workflow template, ordered by Rank.
 */
export async function getWorkflowSteps(
  workflowId: string,
): Promise<BubbleFormWorkflowStep[]> {
  const params = {
    constraints: buildConstraints({ 'Form Workflow': workflowId }),
    ...buildSortParams('Rank', true),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.WORKFLOW_STEP), {
    params,
  });
  return normalizeBubbleList<BubbleFormWorkflowStep>(raw).results;
}

/**
 * Fetches a single workflow step by ID.
 */
export async function getWorkflowStep(
  id: string,
): Promise<BubbleFormWorkflowStep> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.WORKFLOW_STEP, id));
  return normalizeBubbleSingle<BubbleFormWorkflowStep>(raw);
}

// ─── Workflow Logs (Runtime) ──────────────────────────────────────────────────

/**
 * Fetches all runtime workflow log entries for a given evaluation form log.
 * Sorted by creation date ascending so the approval chain reads chronologically.
 */
export async function getWorkflowLog(
  formLogId: string,
): Promise<BubbleEvalWorkflowLog[]> {
  const params = {
    constraints: buildConstraints({ 'Eval Log': formLogId }),
    ...buildSortParams('Created Date', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.WORKFLOW_LOG), { params });
  return normalizeBubbleList<BubbleEvalWorkflowLog>(raw).results;
}

/**
 * Returns the most recent (current) workflow log entry for an eval.
 * Returns null if no workflow log exists yet (eval not yet submitted).
 */
export async function getLatestWorkflowLog(
  formLogId: string,
): Promise<BubbleEvalWorkflowLog | null> {
  const params = {
    constraints: buildConstraints({ 'Eval Log': formLogId }),
    ...buildSortParams('Created Date', false),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.WORKFLOW_LOG), { params });
  const list = normalizeBubbleList<BubbleEvalWorkflowLog>(raw);

  return list.results.length > 0 ? list.results[0] : null;
}

// ─── Current Step Resolution ──────────────────────────────────────────────────

/**
 * Resolves the current active workflow step for an evaluation.
 *
 * Reads the 'Current Workflow Step' ID from the eval form log's workflow log,
 * then fetches the step definition from Bubble.
 *
 * Returns null if the eval is not currently in a workflow step
 * (i.e., draft, complete, or archived).
 */
export async function getCurrentStep(
  formLogId: string,
): Promise<BubbleFormWorkflowStep | null> {
  const workflowLogs = await getWorkflowLog(formLogId);

  if (workflowLogs.length === 0) return null;

  // Find the most recent non-complete workflow log
  const activeLog = workflowLogs.find((log) => !log.Complete) ?? null;
  if (!activeLog || !activeLog['Current Step']) return null;

  try {
    return await getWorkflowStep(activeLog['Current Step']);
  } catch {
    return null;
  }
}

// ─── Workflow Actions ─────────────────────────────────────────────────────────

/**
 * Submits a workflow action for an evaluation via a Bubble backend workflow.
 *
 * The Bubble workflow name follows a convention:
 *   "apex_workflow_[action]" (e.g. "apex_workflow_submit", "apex_workflow_approve")
 *
 * The workflow on the server side:
 *  1. Validates the current step and actor permissions
 *  2. Records the action in the workflow log
 *  3. Advances the eval to the next step or completes it
 */
export async function submitWorkflowAction(
  formLogId: string,
  action: WorkflowAction,
  notes?: string,
): Promise<void> {
  const workflowName = `apex_workflow_${action}`;

  const params: Record<string, unknown> = {
    eval_log_id: formLogId,
    action,
  };

  if (notes !== undefined && notes.trim().length > 0) {
    params.notes = notes.trim();
  }

  await callWorkflow(workflowName, params);
}

/**
 * Submits an evaluation for initial review (moves draft → pending_review).
 * Convenience wrapper around submitWorkflowAction.
 */
export async function submitEvaluation(
  formLogId: string,
  notes?: string,
): Promise<void> {
  return submitWorkflowAction(formLogId, 'submit', notes);
}

/**
 * Approves an evaluation at the current workflow step.
 * Convenience wrapper around submitWorkflowAction.
 */
export async function approveEvaluation(
  formLogId: string,
  notes?: string,
): Promise<void> {
  return submitWorkflowAction(formLogId, 'approve', notes);
}

/**
 * Disputes an evaluation, routing it back to the evaluator.
 * Convenience wrapper around submitWorkflowAction.
 */
export async function disputeEvaluation(
  formLogId: string,
  notes?: string,
): Promise<void> {
  return submitWorkflowAction(formLogId, 'dispute', notes);
}

/**
 * Returns an evaluation to the evaluator for corrections without fully disputing.
 */
export async function returnEvaluation(
  formLogId: string,
  notes?: string,
): Promise<void> {
  return submitWorkflowAction(formLogId, 'return', notes);
}
