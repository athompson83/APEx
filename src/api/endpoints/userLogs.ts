/**
 * userLogs.ts
 * User log / audit trail API — creates and retrieves BubbleUserLog records
 * that form the application's audit trail.
 *
 * Every significant user action in the app (creating evals, scoring,
 * approving, etc.) is logged here for compliance and accountability.
 */

import { get, post } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildSortParams,
  buildPaginationParams,
  dataUrl,
  dataUrlById,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type { BubbleUserLog, LogAction } from '../../types/index';

// ─── Device Info ──────────────────────────────────────────────────────────────

/**
 * Returns a minimal device identifier string for audit log context.
 * We avoid pulling in heavy device info libraries here — callers can
 * pass enriched info via the details parameter.
 */
function getDeviceInfo(): string {
  return 'react-native';
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a user log (audit) record in Bubble.
 *
 * The action parameter is one of the LogAction union values defined in types.
 * The details object can carry any additional context fields that map to
 * the BubbleUserLog interface.
 *
 * This function is intentionally fire-and-forget in most call sites — errors
 * are swallowed so that audit logging failures never block the user's workflow.
 * The offline queue (offlineQueue.ts) handles retry when offline.
 */
export async function createUserLog(
  action: LogAction,
  details: Partial<BubbleUserLog>,
): Promise<BubbleUserLog> {
  if (!details['User']) {
    throw new Error('User ID is required to create a user log');
  }

  const payload: Partial<BubbleUserLog> = {
    ...details,
    Action: action,
    'Device Info': details['Device Info'] ?? getDeviceInfo(),
  };

  // Serialize Metadata if it's an object
  if (
    payload['Metadata'] !== undefined &&
    typeof payload['Metadata'] === 'object'
  ) {
    payload['Metadata'] = JSON.stringify(payload['Metadata']);
  }

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
 * Fetches paginated audit log entries for a given user.
 *
 * Sorted newest first. The cursor is a Bubble integer offset.
 * Returns both the log records and the count of remaining records
 * so the UI can implement "load more" pagination.
 */
export async function getUserLogs(
  userId: string,
  cursor?: string,
): Promise<{ logs: BubbleUserLog[]; remaining: number }> {
  const params = {
    constraints: buildConstraints({ User: userId }),
    ...buildSortParams('Created Date', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  const list = normalizeBubbleList<BubbleUserLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

/**
 * Fetches user logs filtered by action type.
 * Useful for audit views that need to show only a specific action category.
 */
export async function getUserLogsByAction(
  userId: string,
  action: LogAction,
  cursor?: string,
): Promise<{ logs: BubbleUserLog[]; remaining: number }> {
  const params = {
    constraints: buildConstraints({ User: userId, Action: action }),
    ...buildSortParams('Created Date', false),
    ...buildPaginationParams(cursor ? parseInt(cursor, 10) : undefined, 25),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  const list = normalizeBubbleList<BubbleUserLog>(raw);

  return { logs: list.results, remaining: list.remaining };
}

/**
 * Fetches user logs for a specific entity (e.g. all logs related to eval #123).
 * The entityType corresponds to the 'Entity Type' field on BubbleUserLog.
 */
export async function getEntityLogs(
  entityId: string,
  entityType: string,
): Promise<BubbleUserLog[]> {
  const params = {
    constraints: buildConstraints({
      'Entity ID': entityId,
      'Entity Type': entityType,
    }),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), { params });
  return normalizeBubbleList<BubbleUserLog>(raw).results;
}
