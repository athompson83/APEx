/**
 * shifts.ts
 * Shift schedule API — reads shift records imported from external scheduling
 * systems and surfaced in APEx360.
 *
 * Shifts represent work periods for personnel. The Subject field identifies
 * whose shift it is. Shifts do not have a direct Evaluator field — evaluation
 * linking is done via BubbleEvalFormLog's 'Related Shift' reference.
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
import type { BubbleShiftSchedule, ShiftStatus } from '../../types/shift';

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a Date as an ISO 8601 datetime string for Bubble comparison constraints.
 */
function toISOString(date: Date): string {
  return date.toISOString();
}

// ─── Shift Queries ────────────────────────────────────────────────────────────

/**
 * Fetches shifts for the given user as the subject (the person working the shift).
 * Optionally restricts to a date range using Start DateTime comparisons.
 *
 * Results are sorted by Start DateTime ascending so upcoming shifts appear first.
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
      key: 'Start DateTime',
      constraint_type: 'greater than',
      value: toISOString(from),
    });
  }

  if (to) {
    constraints.push({
      key: 'Start DateTime',
      constraint_type: 'less than',
      value: toISOString(to),
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Start DateTime', true),
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
 * Fetches shifts for the given evaluator (by their Subject ID) that are
 * in 'completed' status — these are shifts where an evaluation could be
 * or should have been conducted.
 *
 * Note: The Shift Schedule type tracks the shift worker's data under 'Subject'.
 * An evaluator querying their own completed shifts uses their user ID as Subject.
 */
export async function getShiftsNeedingEval(
  evaluatorId: string,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: evaluatorId },
    { key: 'Status', constraint_type: 'equals', value: 'completed' as ShiftStatus },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('End DateTime', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches all shifts for a given subject within an optional date range.
 * Includes shifts of any status.
 */
export async function getSubjectShifts(
  subjectId: string,
  from?: Date,
  to?: Date,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: subjectId },
  ];

  if (from) {
    constraints.push({
      key: 'Start DateTime',
      constraint_type: 'greater than',
      value: toISOString(from),
    });
  }

  if (to) {
    constraints.push({
      key: 'Start DateTime',
      constraint_type: 'less than',
      value: toISOString(to),
    });
  }

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Start DateTime', false),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches shifts currently in 'active' status for a given subject.
 * Used for the "currently on shift" indicator on roster dashboards.
 */
export async function getActiveShifts(
  subjectId: string,
): Promise<BubbleShiftSchedule[]> {
  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Subject', constraint_type: 'equals', value: subjectId },
      { key: 'Status', constraint_type: 'equals', value: 'active' as ShiftStatus },
    ]),
    limit: 5,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}

/**
 * Fetches shifts for an organization filtered to a date window.
 * Used for the shift overview on admin dashboards.
 */
export async function getOrganizationShifts(
  orgId: string,
  from: Date,
  to: Date,
): Promise<BubbleShiftSchedule[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Organization', constraint_type: 'equals', value: orgId },
    {
      key: 'Start DateTime',
      constraint_type: 'greater than',
      value: toISOString(from),
    },
    {
      key: 'Start DateTime',
      constraint_type: 'less than',
      value: toISOString(to),
    },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Start DateTime', true),
    limit: 200,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.SHIFT_SCHEDULE), {
    params,
  });
  return normalizeBubbleList<BubbleShiftSchedule>(raw).results;
}
