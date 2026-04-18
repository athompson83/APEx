/**
 * userLogs.ts
 * User log / audit trail API — creates and retrieves BubbleUserLog records.
 *
 * BubbleUserLog entries are created for significant system events to provide
 * an immutable audit trail for compliance and operational review.
 */

import { get, post } from '../client';
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
import type { BubbleUserLog, LogAction } from '../../types/userLog';

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a user log (audit) record in Bubble.
 *
 * The action parameter must be one of the LogAction values from types/userLog.ts.
 * The details object carries additional fields that map to BubbleUserLog.
 *
 * The 'Audit' field is a human-readable description of what happened.
 * The 'Content' field holds structured JSON data specific to the action type.
 */
export async function createUserLog(
  action: LogAction,
  details: Partial<BubbleUserLog>,
): Promise<BubbleUserLog> {
  if (!details['Completed By'] && !details['Target User']) {
    throw new Error(
      'At least one of Completed By or Target User is required for a user log',
    );
  }

  const payload: Partial<BubbleUserLog> = {
    ...details,
    Action: action,
    'Is Eval': details['Is Eval'] ?? false,
    Expanded: details['Expanded'] ?? false,
  };

  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), payload);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new UserLog');
  }

  const fetchedRaw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.USER_LOG, created.id),
  );
  return normalizeBubbleSingle<BubbleUserLog>(fetchedRaw);
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches paginated audit log entries where the given user is the actor
 * (Completed By field).
 *
 * Sorted newest first. Returns both the log records and remaining count
 * for "load more" pagination.
 */
export async function getUserLogs(
  userId: string,
  cursor?: string,
): Promise<{ logs: BubbleUserLog[]; remaining: number }> {
  const params = {
    constraints: buildConstraints({ 'Completed By': userId }),
    ...buildSortParams('Created Date', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  const list = normalizeBubbleList<BubbleUserLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

/**
 * Fetches audit log entries about a given subject/target user.
 * Used to view the audit trail for a specific trainee's activities.
 */
export async function getTargetUserLogs(
  targetUserId: string,
  cursor?: string,
): Promise<{ logs: BubbleUserLog[]; remaining: number }> {
  const params = {
    constraints: buildConstraints({ 'Target User': targetUserId }),
    ...buildSortParams('Created Date', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  const list = normalizeBubbleList<BubbleUserLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

/**
 * Fetches audit log entries filtered by action type.
 * Useful for showing only evaluation-related actions, login history, etc.
 */
export async function getUserLogsByAction(
  userId: string,
  action: LogAction,
  cursor?: string,
): Promise<{ logs: BubbleUserLog[]; remaining: number }> {
  const constraints: BubbleConstraint[] = [
    { key: 'Completed By', constraint_type: 'equals', value: userId },
    { key: 'Action', constraint_type: 'equals', value: action },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  const list = normalizeBubbleList<BubbleUserLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

/**
 * Fetches all audit log entries related to a specific entity (e.g. an eval log).
 * Uses the Entity Ref and Entity Type fields to filter.
 */
export async function getEntityLogs(
  entityRef: string,
  entityType: string,
): Promise<BubbleUserLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Entity Ref', constraint_type: 'equals', value: entityRef },
    { key: 'Entity Type', constraint_type: 'equals', value: entityType },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  return normalizeBubbleList<BubbleUserLog>(raw).results;
}

/**
 * Fetches audit log entries related to a specific evaluation form log.
 * Convenience wrapper around getEntityLogs using the 'Is Eval' field.
 */
export async function getEvalLogs(
  evalRef: string,
): Promise<BubbleUserLog[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Is Eval', constraint_type: 'equals', value: true },
    { key: 'Eval Ref', constraint_type: 'equals', value: evalRef },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  return normalizeBubbleList<BubbleUserLog>(raw).results;
}
