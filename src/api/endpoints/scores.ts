/**
 * scores.ts
 * Evaluation Score Log API — individual attribute score records.
 *
 * One BubbleEvalScoreLog exists per attribute per evaluation.
 * The upsertScoreLog function handles the create-or-update pattern
 * since an evaluator may update scores before submitting.
 */

import { get, post, patch } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildConstraintsFromArray,
  buildSortParams,
  dataUrl,
  dataUrlById,
  type BubbleConstraint,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type { BubbleEvalScoreLog } from '../../types/evalFormLog';

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches all score logs for a given evaluation form log.
 * Returns them sorted by category then attribute order (by Created Date as
 * Bubble doesn't expose multi-field sort — UI re-sorts if needed).
 */
export async function getScoreLogs(
  formLogId: string,
): Promise<BubbleEvalScoreLog[]> {
  const params = {
    constraints: buildConstraints({ 'Eval Log': formLogId }),
    ...buildSortParams('Created Date', true),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalScoreLog>(raw).results;
}

/**
 * Fetches score logs for a specific category within an evaluation.
 */
export async function getScoreLogsByCategory(
  formLogId: string,
  categoryId: string,
): Promise<BubbleEvalScoreLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Eval Log', constraint_type: 'equals', value: formLogId },
    { key: 'Eval Category', constraint_type: 'equals', value: categoryId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalScoreLog>(raw).results;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new score log record for a specific attribute.
 */
export async function createScoreLog(
  data: Partial<BubbleEvalScoreLog>,
): Promise<BubbleEvalScoreLog> {
  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_LOG), data);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new EvalScoreLog');
  }

  const fetchedRaw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.EVAL_SCORE_LOG, created.id),
  );
  return normalizeBubbleSingle<BubbleEvalScoreLog>(fetchedRaw);
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Updates an existing score log record.
 */
export async function updateScoreLog(
  id: string,
  data: Partial<BubbleEvalScoreLog>,
): Promise<BubbleEvalScoreLog> {
  await patch<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_SCORE_LOG, id), data);

  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_SCORE_LOG, id));
  return normalizeBubbleSingle<BubbleEvalScoreLog>(raw);
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Creates or updates a score log for a specific form log + category + attribute
 * combination. This is the primary method used during active scoring sessions.
 *
 * Algorithm:
 *  1. Query for an existing score log matching all three IDs.
 *  2. If found → PATCH the existing record.
 *  3. If not found → POST a new record.
 */
export async function upsertScoreLog(
  formLogId: string,
  categoryId: string,
  attributeId: string,
  data: Partial<BubbleEvalScoreLog>,
): Promise<BubbleEvalScoreLog> {
  const constraints: BubbleConstraint[] = [
    { key: 'Eval Log', constraint_type: 'equals', value: formLogId },
    { key: 'Eval Category', constraint_type: 'equals', value: categoryId },
    { key: 'Eval Attribute', constraint_type: 'equals', value: attributeId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_LOG), {
    params,
  });
  const list = normalizeBubbleList<BubbleEvalScoreLog>(raw);

  if (list.results.length > 0) {
    const existing = list.results[0];
    return updateScoreLog(existing._id, data);
  }

  // No existing record — create one with all IDs set
  return createScoreLog({
    ...data,
    'Eval Log': formLogId,
    'Eval Category': categoryId,
    'Eval Attribute': attributeId,
  });
}

// ─── Bulk Fetch ───────────────────────────────────────────────────────────────

/**
 * Fetches score logs for multiple form log IDs in a single request using
 * Bubble's `in` constraint. Useful for list views that need score counts.
 */
export async function getScoreLogsByFormLogIds(
  formLogIds: string[],
): Promise<BubbleEvalScoreLog[]> {
  if (formLogIds.length === 0) return [];

  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Eval Log', constraint_type: 'in', value: formLogIds },
    ]),
    limit: 500,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_LOG), {
    params,
  });
  return normalizeBubbleList<BubbleEvalScoreLog>(raw).results;
}
