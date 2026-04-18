/**
 * bubble.ts
 * Bubble.io API utilities: type names, constraint builders, sort helpers,
 * and workflow API helpers used across all endpoint modules.
 */

import { post } from './client';

// ─── Bubble Data Type Names ───────────────────────────────────────────────────

/**
 * Maps our internal names to Bubble's exact data type names.
 * Used as URL segments in /obj/[type] Data API calls.
 */
export const BUBBLE_TYPES = {
  USER: 'user',
  EVAL_FORM: '[Apex] Evaluation Forms',
  EVAL_FORM_SETTINGS: '[Apex] Eval Form Settings',
  EVAL_FORM_LOG: '[Apex] Eval Form Log',
  EVAL_SCORE_LOG: '[Apex] Eval Scores Log(s)',
  EVAL_SCORE_SETTINGS: '[Apex] Eval Score Settings',
  EVAL_CATEGORY: '[Apex] Eval Categories',
  EVAL_CATEGORY_ATTRIBUTE: '[Apex] Eval Category Attributes',
  FORM_WORKFLOW: '[Apex] Form Workflows',
  WORKFLOW_STEP: '[Apex] Form Workflow Steps',
  WORKFLOW_LOG: '[Apex] Evaluation Workflow Logs',
  PROGRAM: '[Apex] Programs',
  PROGRAM_PHASE: '[Apex] Program Phases',
  PROGRAM_ROSTER: '[Apex] Program Rosters',
  PHASE_REQUIREMENT: '[Apex] Phase Requirements',
  TASK: '[Apex] Tasks',
  TASKBOOK_LOG: '[Apex] Taskbook Logs',
  ASSESSMENT: '[Apex] Assessments',
  QUIZ: 'Quizzes',
  QUESTION_MC: 'Assessment Question (MC)s',
  TEST_RESULT: 'TestResults',
  SHIFT_SCHEDULE: '[APEx] Shift Schedules',
  PROGRESS_NOTE: '[Apex] Progress notes',
  USER_LOG: '[Apex] User Logs',
} as const;

export type BubbleTypeName = (typeof BUBBLE_TYPES)[keyof typeof BUBBLE_TYPES];

// ─── Constraint Types ─────────────────────────────────────────────────────────

export type ConstraintType =
  | 'equals'
  | 'not equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'text contains'
  | 'not text contains'
  | 'greater than'
  | 'less than'
  | 'in'
  | 'not in';

export interface BubbleConstraint {
  key: string;
  constraint_type: ConstraintType;
  value?: unknown;
}

// ─── Constraint Builder ───────────────────────────────────────────────────────

/**
 * Converts a flat filter map into a Bubble constraints query string.
 *
 * Each key-value pair becomes an `equals` constraint.
 * Pass `null` as a value to generate an `is_empty` constraint.
 *
 * Example:
 *   buildConstraints({ Status: 'active', Organization: 'org123' })
 *   → '%5B%7B%22key%22%3A%22Status%22...'
 */
export function buildConstraints(filters: Record<string, unknown>): string {
  const constraints: BubbleConstraint[] = Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (value === null) {
        return { key, constraint_type: 'is_empty' };
      }
      return { key, constraint_type: 'equals', value };
    });

  return encodeURIComponent(JSON.stringify(constraints));
}

/**
 * Builds a constraints string from an array of explicit BubbleConstraint
 * objects, useful when you need constraint types other than `equals`.
 */
export function buildConstraintsFromArray(
  constraints: BubbleConstraint[],
): string {
  return encodeURIComponent(JSON.stringify(constraints));
}

// ─── Sort Builder ─────────────────────────────────────────────────────────────

/**
 * Returns the `sort_field` and `descending` query params for Bubble list
 * requests as a plain object to spread into `params`.
 *
 * Example:
 *   params: { ...buildSortParams('Created Date', false), constraints: '...' }
 */
export function buildSortParams(
  field: string,
  ascending: boolean,
): Record<string, string> {
  return {
    sort_field: field,
    descending: ascending ? 'false' : 'true',
  };
}

/**
 * Returns only the URL-encoded sort string (legacy helper kept for
 * callers that build their own param strings).
 */
export function buildSortParam(field: string, ascending: boolean): string {
  const params = new URLSearchParams(buildSortParams(field, ascending));
  return params.toString();
}

// ─── ID Validation ────────────────────────────────────────────────────────────

/**
 * Validates and returns a Bubble object ID.
 * Bubble IDs are alphanumeric strings of length 20.
 * Throws if the ID is obviously malformed to catch programming errors early.
 */
export function parseBubbleId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid Bubble ID: ${String(id)}`);
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new Error('Bubble ID must not be empty');
  }
  // Bubble IDs are typically 20-char alphanumeric, but we accept any non-empty
  // string to remain forward-compatible with Bubble's ID format.
  return trimmed;
}

// ─── URL Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a Data API path for a list endpoint.
 * Encodes the type name so space characters are safe in URLs.
 */
export function dataUrl(typeName: string): string {
  return `/obj/${encodeURIComponent(typeName)}`;
}

/**
 * Builds a Data API path for a single-object endpoint.
 */
export function dataUrlById(typeName: string, id: string): string {
  return `/obj/${encodeURIComponent(typeName)}/${parseBubbleId(id)}`;
}

// ─── Workflow API Helpers ─────────────────────────────────────────────────────

/**
 * Calls a Bubble backend workflow (server-side action) via the
 * Workflow API endpoint at /wf/[workflow-name].
 *
 * Bubble returns 200 with `{ status: "success" }` on success.
 */
export async function callWorkflow(
  workflowName: string,
  params: Record<string, unknown>,
): Promise<void> {
  await post<{ status: string }>(
    `/wf/${encodeURIComponent(workflowName)}`,
    params,
  );
}

// ─── Pagination Helpers ───────────────────────────────────────────────────────

/**
 * Builds pagination params for Bubble list requests.
 * Bubble uses `cursor` for offset-based pagination.
 */
export function buildPaginationParams(
  cursor?: string | number,
  limit = 100,
): Record<string, string | number> {
  const params: Record<string, string | number> = { limit };
  if (cursor !== undefined) {
    params.cursor = cursor;
  }
  return params;
}
