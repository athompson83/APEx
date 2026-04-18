/**
 * rosters.ts
 * Program roster and phase API — fetches trainee enrollment records,
 * current phase, phase requirements, and program definitions.
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
import type {
  BubbleProgramRoster,
  BubbleProgramPhase,
  BubblePhaseRequirement,
  BubbleProgram,
} from '../../types/roster';

// ─── Roster Queries ───────────────────────────────────────────────────────────

/**
 * Fetches the active program roster entry for a given user (as subject/intern).
 * Returns null if the user is not currently enrolled in an active program.
 *
 * Filters to Active = true to exclude completed or terminated enrollments.
 * Sorted by Start Date descending in case of multiple entries (returns most recent).
 */
export async function getMyRoster(
  userId: string,
): Promise<BubbleProgramRoster | null> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: userId },
    { key: 'Active', constraint_type: 'equals', value: true },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Start Date', false),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_ROSTER), {
    params,
  });
  const list = normalizeBubbleList<BubbleProgramRoster>(raw);

  return list.results.length > 0 ? list.results[0] : null;
}

/**
 * Fetches a roster record by its Bubble ID.
 */
export async function getRoster(id: string): Promise<BubbleProgramRoster> {
  const raw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.PROGRAM_ROSTER, id),
  );
  return normalizeBubbleSingle<BubbleProgramRoster>(raw);
}

/**
 * Fetches all active roster entries where the given user is the assigned trainer.
 * Used by FTOs to see all their currently assigned trainees.
 *
 * Note: BubbleProgramRoster uses 'Assigned Trainer' for the primary trainer
 * and 'Additional Trainers' for secondary assignments.
 */
export async function getSubjectRosters(
  evaluatorId: string,
): Promise<BubbleProgramRoster[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Assigned Trainer', constraint_type: 'equals', value: evaluatorId },
    { key: 'Active', constraint_type: 'equals', value: true },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Start Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_ROSTER), {
    params,
  });
  return normalizeBubbleList<BubbleProgramRoster>(raw).results;
}

/**
 * Fetches all roster entries (active and historical) for a given subject.
 * Includes completed and terminated enrollments for the record history view.
 */
export async function getAllRostersForSubject(
  subjectId: string,
): Promise<BubbleProgramRoster[]> {
  const params = {
    constraints: buildConstraints({ Subject: subjectId }),
    ...buildSortParams('Start Date', false),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_ROSTER), {
    params,
  });
  return normalizeBubbleList<BubbleProgramRoster>(raw).results;
}

// ─── Phase Queries ────────────────────────────────────────────────────────────

/**
 * Returns the current active program phase for a given roster entry.
 * Reads the 'Current Phase' field from the roster and fetches the phase record.
 * Returns null if the roster has no current phase set.
 */
export async function getCurrentPhase(
  rosterId: string,
): Promise<BubbleProgramPhase | null> {
  const roster = await getRoster(rosterId);
  if (!roster['Current Phase']) return null;

  try {
    const raw = await get<unknown>(
      dataUrlById(BUBBLE_TYPES.PROGRAM_PHASE, roster['Current Phase']),
    );
    return normalizeBubbleSingle<BubbleProgramPhase>(raw);
  } catch {
    return null;
  }
}

/**
 * Fetches all phases belonging to a given program, sorted by Rank ascending.
 */
export async function getProgramPhases(
  programId: string,
): Promise<BubbleProgramPhase[]> {
  const params = {
    constraints: buildConstraints({ Program: programId }),
    ...buildSortParams('Rank', true),
    limit: 20,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_PHASE), {
    params,
  });
  return normalizeBubbleList<BubbleProgramPhase>(raw).results;
}

/**
 * Fetches a single program phase by ID.
 */
export async function getProgramPhase(id: string): Promise<BubbleProgramPhase> {
  const raw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.PROGRAM_PHASE, id),
  );
  return normalizeBubbleSingle<BubbleProgramPhase>(raw);
}

// ─── Phase Requirements ───────────────────────────────────────────────────────

/**
 * Fetches all phase requirements for a given program phase, sorted by Rank.
 * Requirements define what a trainee must complete to advance.
 */
export async function getPhaseRequirements(
  phaseId: string,
): Promise<BubblePhaseRequirement[]> {
  const params = {
    constraints: buildConstraints({ 'Program Phase': phaseId }),
    ...buildSortParams('Rank', true),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PHASE_REQUIREMENT), {
    params,
  });
  return normalizeBubbleList<BubblePhaseRequirement>(raw).results;
}

// ─── Program Queries ──────────────────────────────────────────────────────────

/**
 * Fetches a single program definition by ID.
 */
export async function getProgram(id: string): Promise<BubbleProgram> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.PROGRAM, id));
  return normalizeBubbleSingle<BubbleProgram>(raw);
}

/**
 * Fetches all active programs.
 * Optionally filters to programs belonging to a specific organization.
 */
export async function getPrograms(
  orgId?: string,
): Promise<BubbleProgram[]> {
  const filters: Record<string, unknown> = { Active: true };
  if (orgId) {
    filters['Organizations'] = orgId;
  }

  const params = {
    constraints: buildConstraints(filters),
    ...buildSortParams('Program Name', true),
    limit: 50,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM), { params });
  return normalizeBubbleList<BubbleProgram>(raw).results;
}
