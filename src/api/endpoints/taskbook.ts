/**
 * taskbook.ts
 * Taskbook API — manages task completion logs within a training program phase.
 *
 * Tasks are discrete checklist items a trainee must complete during a phase.
 * BubbleTaskbookLog records track the per-trainee status of each task.
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
import type { BubbleTaskbookLog, BubbleTask } from '../../types/index';

// ─── Taskbook Log Queries ─────────────────────────────────────────────────────

/**
 * Fetches all taskbook log entries for a given program roster.
 * Optionally filters to a specific program phase.
 *
 * Returns all tasks regardless of completion status so the UI can render
 * the full taskbook checklist with completion indicators.
 */
export async function getTaskbookLogs(
  rosterId: string,
  phaseId?: string,
): Promise<BubbleTaskbookLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Program Roster', constraint_type: 'equals', value: rosterId },
  ];

  if (phaseId) {
    constraints.push({
      key: 'Program Phase',
      constraint_type: 'equals',
      value: phaseId,
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', true),
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
 * Fetches taskbook logs filtered by status for a given roster.
 * Useful for showing "pending tasks" or "completed tasks" lists.
 */
export async function getTaskbookLogsByStatus(
  rosterId: string,
  status: BubbleTaskbookLog['Status'],
  phaseId?: string,
): Promise<BubbleTaskbookLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Program Roster', constraint_type: 'equals', value: rosterId },
    { key: 'Status', constraint_type: 'equals', value: status },
  ];

  if (phaseId) {
    constraints.push({
      key: 'Program Phase',
      constraint_type: 'equals',
      value: phaseId,
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', true),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), { params });
  return normalizeBubbleList<BubbleTaskbookLog>(raw).results;
}

// ─── Create / Update ─────────────────────────────────────────────────────────

/**
 * Creates a new taskbook log record.
 * Typically called when a program phase starts and tasks need to be
 * initialized for a trainee (one log per task per roster).
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
 * Marks a taskbook log entry as complete.
 *
 * Sets Status to 'complete', records the completing user, and timestamps
 * the completion. The server-side Bubble workflow may also update phase
 * progress counters.
 */
export async function markTaskComplete(
  logId: string,
  completedBy: string,
): Promise<BubbleTaskbookLog> {
  const data: Partial<BubbleTaskbookLog> = {
    Status: 'complete',
    'Completed By': completedBy,
    'Completed Date': new Date().toISOString(),
  };

  return updateTaskbookLog(logId, data);
}

/**
 * Marks a taskbook log entry as in_progress.
 * Used when an evaluator begins working through a task with a trainee.
 */
export async function startTask(logId: string): Promise<BubbleTaskbookLog> {
  return updateTaskbookLog(logId, { Status: 'in_progress' });
}

// ─── Task Definitions ─────────────────────────────────────────────────────────

/**
 * Fetches a task definition record by ID.
 * Task definitions describe what needs to be done; taskbook logs track
 * whether it's been done for a specific trainee.
 */
export async function getTask(id: string): Promise<BubbleTask> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.TASK, id));
  return normalizeBubbleSingle<BubbleTask>(raw);
}

/**
 * Fetches all task definitions for a given program phase, sorted by Order.
 */
export async function getTasksByPhase(phaseId: string): Promise<BubbleTask[]> {
  const params = {
    constraints: buildConstraints({ 'Program Phase': phaseId }),
    ...buildSortParams('Order', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASK), { params });
  return normalizeBubbleList<BubbleTask>(raw).results;
}
