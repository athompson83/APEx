/**
 * formLogs.ts
 * Evaluation Form Log API — the core runtime evaluation data.
 *
 * A BubbleEvalFormLog is the live instance of a form being evaluated.
 * This module handles fetching, creating, and updating those records
 * along with role-based filtering logic.
 */

import { get, post, patch } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildConstraintsFromArray,
  buildSortParams,
  buildPaginationParams,
  dataUrl,
  dataUrlById,
  type BubbleConstraint,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type { BubbleEvalFormLog } from '../../types/evalFormLog';
import type { APExRole } from '../../types/user';

// ─── Terminal Statuses ────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ['draft', 'in_progress', 'pending_review', 'disputed'];
const COMPLETED_STATUSES = ['approved', 'complete', 'archived'];

// ─── Fetching Active Evals ────────────────────────────────────────────────────

/**
 * Returns evaluations that are currently in-flight for the given user.
 *
 * Role-based filtering:
 *  - subject   → evals where Subject = userId
 *  - evaluator → evals where Evaluator = userId
 *  - reviewer  → evals in pending_review/disputed states across all subjects
 *  - admin     → all active evals (no user filter)
 */
export async function getActiveFormLogs(
  userId: string,
  role: APExRole,
): Promise<BubbleEvalFormLog[]> {
  const statusConstraints: BubbleConstraint[] = ACTIVE_STATUSES.map(
    (status) => ({
      key: 'Status',
      constraint_type: 'in',
      value: ACTIVE_STATUSES,
    }),
  ).slice(0, 1); // Only need one `in` constraint

  const constraints: BubbleConstraint[] = [
    { key: 'Status', constraint_type: 'in', value: ACTIVE_STATUSES },
  ];

  switch (role) {
    case 'subject':
      constraints.push({
        key: 'Subject',
        constraint_type: 'equals',
        value: userId,
      });
      break;

    case 'evaluator':
      constraints.push({
        key: 'Evaluator',
        constraint_type: 'equals',
        value: userId,
      });
      break;

    case 'reviewer':
      // Reviewers see evals awaiting review or in disputed state
      constraints[0] = {
        key: 'Status',
        constraint_type: 'in',
        value: ['pending_review', 'disputed'],
      };
      break;

    case 'admin':
      // No additional user filter — admin sees all
      break;
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Modified Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalFormLog>(raw).results;
}

// ─── Fetching Completed Evals ─────────────────────────────────────────────────

/**
 * Returns paginated completed evaluations for a user.
 * Cursor is the Bubble pagination cursor (integer offset).
 */
export async function getCompletedFormLogs(
  userId: string,
  role: APExRole,
  cursor?: string,
): Promise<{ logs: BubbleEvalFormLog[]; remaining: number }> {
  const constraints: BubbleConstraint[] = [
    { key: 'Status', constraint_type: 'in', value: COMPLETED_STATUSES },
  ];

  switch (role) {
    case 'subject':
      constraints.push({
        key: 'Subject',
        constraint_type: 'equals',
        value: userId,
      });
      break;

    case 'evaluator':
      constraints.push({
        key: 'Evaluator',
        constraint_type: 'equals',
        value: userId,
      });
      break;

    case 'reviewer':
    case 'admin':
      // No additional filter — sees all completed
      break;
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Completed At', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), {
    params,
  });
  const list = normalizeBubbleList<BubbleEvalFormLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

// ─── Single Record ────────────────────────────────────────────────────────────

/**
 * Fetches a single EvalFormLog by ID.
 */
export async function getFormLog(id: string): Promise<BubbleEvalFormLog> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_FORM_LOG, id));
  return normalizeBubbleSingle<BubbleEvalFormLog>(raw);
}

// ─── Roster-Based Queries ─────────────────────────────────────────────────────

/**
 * Fetches all eval logs associated with a given program roster entry.
 * Sorted by creation date descending (newest first).
 */
export async function getFormLogsByRoster(
  rosterId: string,
): Promise<BubbleEvalFormLog[]> {
  const params = {
    constraints: buildConstraints({ 'Program Roster': rosterId }),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalFormLog>(raw).results;
}

/**
 * Returns all child evaluation logs for a given parent eval log.
 * Used in multi-part evaluations where a parent eval spawns sub-evals.
 */
export async function getChildEvals(
  parentLogId: string,
): Promise<BubbleEvalFormLog[]> {
  const params = {
    constraints: buildConstraints({ 'Parent Eval Log': parentLogId }),
    ...buildSortParams('Created Date', true),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalFormLog>(raw).results;
}

// ─── Create / Update ─────────────────────────────────────────────────────────

/**
 * Creates a new EvalFormLog record in Bubble.
 * The initial status is typically 'draft' or 'in_progress'.
 */
export async function createFormLog(
  data: Partial<BubbleEvalFormLog>,
): Promise<BubbleEvalFormLog> {
  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), data);
  // Bubble POST returns { id: string } — we then fetch the full object
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new EvalFormLog');
  }
  return getFormLog(created.id);
}

/**
 * Updates an existing EvalFormLog record via Bubble's PATCH endpoint.
 */
export async function updateFormLog(
  id: string,
  data: Partial<BubbleEvalFormLog>,
): Promise<BubbleEvalFormLog> {
  await patch<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_FORM_LOG, id), data);
  // Bubble PATCH returns { status: 'ok' }, so re-fetch for the updated record
  return getFormLog(id);
}

// ─── Action Queue ─────────────────────────────────────────────────────────────

/**
 * Returns evals that require action from the given user based on their role.
 *
 * "Needs my action" means the ball is in this user's court — either they
 * are the current workflow step owner or the eval is assigned to them
 * in a state that needs input.
 */
export async function getFormLogsNeedingMyAction(
  userId: string,
  role: APExRole,
): Promise<BubbleEvalFormLog[]> {
  const constraints: BubbleConstraint[] = [];

  switch (role) {
    case 'subject':
      // Subject needs to act when the eval is in disputed state (their response)
      // or when acknowledged = false on a completed eval
      constraints.push(
        { key: 'Subject', constraint_type: 'equals', value: userId },
        { key: 'Status', constraint_type: 'in', value: ['disputed', 'approved'] },
      );
      break;

    case 'evaluator':
      // Evaluator needs to act on drafts and on disputed evals routed back to them
      constraints.push(
        { key: 'Evaluator', constraint_type: 'equals', value: userId },
        {
          key: 'Status',
          constraint_type: 'in',
          value: ['draft', 'in_progress', 'disputed'],
        },
      );
      break;

    case 'reviewer':
      // Reviewer needs to act on evals pending their review
      constraints.push({
        key: 'Status',
        constraint_type: 'in',
        value: ['pending_review'],
      });
      break;

    case 'admin':
      // Admin sees everything needing action
      constraints.push({
        key: 'Status',
        constraint_type: 'in',
        value: ['pending_review', 'disputed'],
      });
      break;
  }

  if (constraints.length === 0) {
    return [];
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Modified Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalFormLog>(raw).results;
}
