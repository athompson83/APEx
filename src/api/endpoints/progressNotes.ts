/**
 * progressNotes.ts
 * Progress notes API — manages narrative observations written by trainers
 * about trainees during their program enrollment.
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
import type {
  BubbleProgressNote,
  ProgressNoteReason,
} from '../../types/progressNote';

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches all progress notes for a given subject (trainee).
 *
 * Bubble's server-side privacy rules control which notes are returned
 * based on the authenticated user's role. Notes where 'Visible to Subject'
 * is false are filtered by Bubble before they reach the client.
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
 * Fetches progress notes filtered by reason category.
 * Useful for showing only commendations, concerns, etc.
 */
export async function getProgressNotesByReason(
  subjectId: string,
  reason: ProgressNoteReason,
): Promise<BubbleProgressNote[]> {
  const constraints: BubbleConstraint[] = [
    { key: 'Subject', constraint_type: 'equals', value: subjectId },
    { key: 'Reason', constraint_type: 'equals', value: reason },
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
 * The Creator field should be the authenticated user's Bubble _id.
 * The 'Note' field is the primary text content.
 * 'Visible to Subject' controls whether the trainee can see this note.
 */
export async function createProgressNote(
  data: Partial<BubbleProgressNote>,
): Promise<BubbleProgressNote> {
  if (!data['Subject']) {
    throw new Error('Subject ID is required to create a progress note');
  }
  if (!data['Creator']) {
    throw new Error('Creator ID is required to create a progress note');
  }
  if (!data['Note'] || (data['Note'] as string).trim().length === 0) {
    throw new Error('Note text is required and must not be empty');
  }
  if (!data['Reason']) {
    throw new Error('Reason is required to create a progress note');
  }

  const payload: Partial<BubbleProgressNote> = {
    ...data,
    Note: (data['Note'] as string).trim(),
    'Visible to Subject': data['Visible to Subject'] ?? false,
    'Subject Acknowledged': false,
  };

  const raw = await post<unknown>(dataUrl(BUBBLE_TYPES.PROGRESS_NOTE), payload);
  const created = raw as { id?: string };
  if (!created.id) {
    throw new Error('Bubble did not return an ID for the new ProgressNote');
  }

  return getProgressNote(created.id);
}

/**
 * Creates an internal-only progress note (not visible to the trainee).
 * Convenience wrapper around createProgressNote.
 */
export async function createInternalNote(
  subjectId: string,
  creatorId: string,
  note: string,
  reason: ProgressNoteReason,
  rosterId?: string,
  phaseId?: string,
): Promise<BubbleProgressNote> {
  return createProgressNote({
    Subject: subjectId,
    Creator: creatorId,
    Note: note,
    Reason: reason,
    'Visible to Subject': false,
    'Subject Acknowledged': false,
    'Program Roster': rosterId,
    'Program Phase': phaseId,
  });
}

/**
 * Creates a progress note visible to the trainee.
 * Convenience wrapper around createProgressNote.
 */
export async function createVisibleNote(
  subjectId: string,
  creatorId: string,
  note: string,
  reason: ProgressNoteReason,
  rosterId?: string,
  phaseId?: string,
): Promise<BubbleProgressNote> {
  return createProgressNote({
    Subject: subjectId,
    Creator: creatorId,
    Note: note,
    Reason: reason,
    'Visible to Subject': true,
    'Subject Acknowledged': false,
    'Program Roster': rosterId,
    'Program Phase': phaseId,
  });
}
