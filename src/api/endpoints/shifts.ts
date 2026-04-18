/**
 * shifts.ts
 * Shift schedule API — manages shift records associated with EMS evaluations.
 *
 * Shifts represent scheduled work periods during which an evaluator may
 * conduct evaluations of their assigned subject.
 */

import { get } from '../client';
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
import type { BubbleShiftSchedule } from '../../types/index';

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a Date as an ISO 8601 date string (YYYY-MM-DD) for Bubble queries.
 * Bubble's date fields use ISO format for comparison constraints.
 */
function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ─── Shift Queries ────────────────────────────────────────────────────────────

/**
 * Fetches shifts for the given user as subject.
 * Optionally restricts to a date range.
 *
 * Results are sorted by Shift Date ascending so upcoming shifts appear first.
 */
export async function getMyShifts(
  userId: string,
  from?: Date,
  to?: Date,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: userId },
  ];

  if (from) {
    constraints.push({
      key: 'Shift Date',
      constraint_type: 'greater than',
      value: toISODateString(from),
    });
  }

  if (to) {
    constraints.push({
      key: 'Shift Date',
      constraint_type: 'less than',
      value: toISODateString(to),
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Shift Date', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches a single shift record by ID.
 */
export async function getShift(id: string): Promise<BubbleShiftSchedule> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.SHIFT_SCHEDULE, id));
  return normalizeBubbleSingle<BubbleShiftSchedule>(raw);
}

/**
 * Fetches shifts assigned to an evaluator where an evaluation is required
 * but has not yet been completed.
 *
 * These are the shifts the evaluator still needs to evaluate — the "action
 * required" list for evaluators.
 */
export async function getShiftsNeedingEval(
  evaluatorId: string,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Evaluator', constraint_type: 'equals', value: evaluatorId },
    { key: 'Eval Required', constraint_type: 'equals', value: true },
    { key: 'Eval Completed', constraint_type: 'equals', value: false },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Shift Date', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches shifts for an evaluator within an optional date range.
 * Includes both completed and pending evaluations.
 */
export async function getEvaluatorShifts(
  evaluatorId: string,
  from?: Date,
  to?: Date,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Evaluator', constraint_type: 'equals', value: evaluatorId },
  ];

  if (from) {
    constraints.push({
      key: 'Shift Date',
      constraint_type: 'greater than',
      value: toISODateString(from),
    });
  }

  if (to) {
    constraints.push({
      key: 'Shift Date',
      constraint_type: 'less than',
      value: toISODateString(to),
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Shift Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches all shifts for a given program roster entry.
 * Used to display the full shift history for a trainee.
 */
export async function getShiftsByRoster(
  rosterId: string,
): Promise<BubbleShiftSchedule[]> {
  const params = {
    constraints: buildConstraints({ 'Program Roster': rosterId }),
    ...buildSortParams('Shift Date', false),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches today's shifts for a given evaluator.
 * Convenience helper for the dashboard "today's shifts" widget.
 */
export async function getTodayShifts(
  evaluatorId: string,
): Promise<BubbleShiftSchedule[]> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEvaluatorShifts(evaluatorId, today, tomorrow);
}
