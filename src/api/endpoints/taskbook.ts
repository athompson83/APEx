/**
 * taskbook.ts
 * Taskbook API — manages task completion logs within a training program phase.
 *
 * Tasks are discrete checklist items a trainee must complete during a phase.
 * BubbleTaskbookLog records track per-trainee completion of each task.
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
import type { BubbleTaskbookLog, BubbleTask } from '../../types/taskbook';

// ─── Taskbook Log Queries ─────────────────────────────────────────────────────

/**
 * Fetches all taskbook log entries for a given trainee and phase.
 * The `subjectId` maps to the 'Intern User' field on BubbleTaskbookLog.
 * Optionally filters to a specific program phase.
 */
export async function getTaskbookLogs(
  subjectId: string,
  phaseId?: string,
): Promise<BubbleTaskbookLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Intern User', constraint_type: 'equals', value: subjectId },
  ];

  if (phaseId) {
    constraints.push({
      key: 'Phase',
      constraint_type: 'equals',
      value: phaseId,
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Completed At', true),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), { params });
  return normalizeBubbleList<BubbleTaskbookLog>(raw).results;
}

/**
 * Fetches a single taskbook log entry by ID.
 */
export async function getTaskbookLog(id: string): Promise<BubbleTaskbookLog> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.TASKBOOK_LOG, id));
  return normalizeBubbleSingle<BubbleTaskbookLog>(raw);
}

/**
 * Fetches taskbook logs for a requirement, filtered by completion status.
 * Useful for showing "completed" vs "pending cosign" vs "not yet attempted".
 */
export async function getTaskbookLogsByRequirement(
  requirementId: string,
  subjectId: string,
): Promise<BubbleTaskbookLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Requirement', constraint_type: 'equals', value: requirementId },
    { key: 'Intern User', constraint_type: 'equals', value: subjectId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Completed At', true),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), { params });
  return normalizeBubbleList<BubbleTaskbookLog>(raw).results;
}

/**
 * Fetches all taskbook logs awaiting cosign from a given trainer/evaluator.
 */
export async function getCosignPendingLogs(
  phaseId?: string,
): Promise<BubbleTaskbookLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Cosign Pending', constraint_type: 'equals', value: true },
  ];

  if (phaseId) {
    constraints.push({
      key: 'Phase',
      constraint_type: 'equals',
      value: phaseId,
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Completed At', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), { params });
  return normalizeBubbleList<BubbleTaskbookLog>(raw).results;
}

// ─── Create / Update ─────────────────────────────────────────────────────────

/**
 * Creates a new taskbook log record for a task completion attempt.
 */
export async function createTaskbookLog(
  data: Partial<BubbleTaskbookLog>,
): Promise<BubbleTaskbookLog> {
  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), data);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new TaskbookLog');
  }
  return getTaskbookLog(created.id);
}

/**
 * Updates an existing taskbook log entry.
 */
export async function updateTaskbookLog(
  id: string,
  data: Partial<BubbleTaskbookLog>,
): Promise<BubbleTaskbookLog> {
  await patch<unknown>(dataUrlById(BUBBLE_TYPES.TASKBOOK_LOG, id), data);
  return getTaskbookLog(id);
}

// ─── Task Completion ──────────────────────────────────────────────────────────

/**
 * Marks a taskbook log entry as successfully complete.
 *
 * Sets Success to true and records the completing user and timestamp.
 * If the task requires cosign, sets Cosign Pending to true.
 */
export async function markTaskComplete(
  logId: string,
  completedBy: string,
): Promise<BubbleTaskbookLog> {
  const data: Partial<BubbleTaskbookLog> = {
    Success: true,
    'Completed By': completedBy,
    'Completed At': new Date().toISOString(),
  };

  return updateTaskbookLog(logId, data);
}

/**
 * Records a cosign on a taskbook log entry.
 * Clears the Cosign Pending flag and records the cosigning user.
 */
export async function cosignTaskLog(
  logId: string,
  cosignedBy: string,
): Promise<BubbleTaskbookLog> {
  const data: Partial<BubbleTaskbookLog> = {
    'Cosign Pending': false,
    'Cosigned By': cosignedBy,
    'Cosigned At': new Date().toISOString(),
  };

  return updateTaskbookLog(logId, data);
}

// ─── Task Definitions ─────────────────────────────────────────────────────────

/**
 * Fetches a task definition record by ID.
 */
export async function getTask(id: string): Promise<BubbleTask> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.TASK, id));
  return normalizeBubbleSingle<BubbleTask>(raw);
}

/**
 * Fetches all active task definitions.
 * Tasks are referenced by phase requirements and taskbook logs.
 */
export async function getAllTasks(): Promise<BubbleTask[]> {
  const params = {
    constraints: buildConstraints({ Active: true }),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASK), { params });
  return normalizeBubbleList<BubbleTask>(raw).results;
}
