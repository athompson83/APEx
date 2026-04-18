/**
 * progressNotes.ts
 * Progress notes API — manages narrative notes written about a trainee's
 * progress during their program enrollment.
 *
 * Notes can be visible to the trainee or marked private (evaluator/admin only).
 */

import { get, post } from '../client';
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
import type { BubbleProgressNote } from '../../types/index';

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches all progress notes for a given subject (trainee).
 *
 * Note: Private notes (Is Private = true) are stored in Bubble with
 * privacy rules enforced server-side. The API will only return notes
 * the authenticated user is permitted to see, so no client-side filtering
 * is needed here.
 *
 * Results are sorted newest first.
 */
export async function getProgressNotes(
  subjectId: string,
): Promise<BubbleProgressNote[]> {
  const params = {
    constraints: buildConstraints({ Subject: subjectId }),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRESS_NOTE), {
    params,
  });
  return normalizeBubbleList<BubbleProgressNote>(raw).results;
}

/**
 * Fetches progress notes for a subject filtered to a specific program roster.
 * Useful when a subject has multiple roster entries and you want notes
 * from only one enrollment period.
 */
export async function getProgressNotesByRoster(
  subjectId: string,
  rosterId: string,
): Promise<BubbleProgressNote[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: subjectId },
    { key: 'Program Roster', constraint_type: 'equals', value: rosterId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRESS_NOTE), {
    params,
  });
  return normalizeBubbleList<BubbleProgressNote>(raw).results;
}

/**
 * Fetches progress notes for a subject within a specific program phase.
 */
export async function getProgressNotesByPhase(
  subjectId: string,
  phaseId: string,
): Promise<BubbleProgressNote[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: subjectId },
    { key: 'Program Phase', constraint_type: 'equals', value: phaseId },
  ];

  const params = {
    constraints: buildConstraintsFromArray(constraints),
    ...buildSortParams('Created Date', false),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRESS_NOTE), {
    params,
  });
  return normalizeBubbleList<BubbleProgressNote>(raw).results;
}

/**
 * Fetches a single progress note by ID.
 */
export async function getProgressNote(id: string): Promise<BubbleProgressNote> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.PROGRESS_NOTE, id));
  return normalizeBubbleSingle<BubbleProgressNote>(raw);
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new progress note for a subject.
 *
 * The author field should be set to the current authenticated user's ID.
 * The Created Date and Modified Date are managed by Bubble automatically.
 */
export async function createProgressNote(
  data: Partial<BubbleProgressNote>,
): Promise<BubbleProgressNote> {
  if (!data['Subject']) {
    throw new Error('Subject ID is required to create a progress note');
  }
  if (!data['Author']) {
    throw new Error('Author ID is required to create a progress note');
  }
  if (!data['Note Text'] || (data['Note Text'] as string).trim().length === 0) {
    throw new Error('Note text is required and must not be empty');
  }

  const payload: Partial<BubbleProgressNote> = {
    ...data,
    'Note Text': (data['Note Text'] as string).trim(),
    'Is Private': data['Is Private'] ?? false,
  };

  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.PROGRESS_NOTE), payload);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new ProgressNote');
  }

  return getProgressNote(created.id);
}

/**
 * Creates a private progress note (visible only to evaluators and admins).
 * Convenience wrapper around createProgressNote.
 */
export async function createPrivateNote(
  subjectId: string,
  authorId: string,
  noteText: string,
  rosterId?: string,
  phaseId?: string,
): Promise<BubbleProgressNote> {
  return createProgressNote({
    Subject: subjectId,
    Author: authorId,
    'Note Text': noteText,
    'Is Private': true,
    'Program Roster': rosterId,
    'Program Phase': phaseId,
  });
}

/**
 * Creates a visible progress note (shared with the subject).
 * Convenience wrapper around createProgressNote.
 */
export async function createVisibleNote(
  subjectId: string,
  authorId: string,
  noteText: string,
  rosterId?: string,
  phaseId?: string,
): Promise<BubbleProgressNote> {
  return createProgressNote({
    Subject: subjectId,
    Author: authorId,
    'Note Text': noteText,
    'Is Private': false,
    'Program Roster': rosterId,
    'Program Phase': phaseId,
  });
}
