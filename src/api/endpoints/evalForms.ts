/**
 * evalForms.ts
 * Evaluation form template API — fetches form definitions, settings,
 * categories, attributes, and score settings from Bubble.
 *
 * These are the static template records. Runtime evaluation data
 * is in formLogs.ts and scores.ts.
 */

import { get } from '../client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildSortParams,
  dataUrl,
  dataUrlById,
} from '../bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '../client';
import type {
  BubbleEvalForm,
  BubbleEvalFormSettings,
  BubbleEvalCategory,
  BubbleEvalCategoryAttribute,
  BubbleEvalScoreSettings,
} from '../../types/evalForm';

// ─── Eval Forms ───────────────────────────────────────────────────────────────

/**
 * Fetches all active evaluation form templates.
 * Optionally filters to a specific organization.
 */
export async function getEvalForms(
  orgId?: string,
): Promise<BubbleEvalForm[]> {
  const filters: Record<string, unknown> = { Active: true };
  if (orgId) {
    filters['Organizations'] = orgId;
  }

  const params: Record<string, unknown> = {
    constraints: buildConstraints(filters),
    ...buildSortParams('Form Name', true),
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM), { params });
  return normalizeBubbleList<BubbleEvalForm>(raw).results;
}

/**
 * Fetches a single evaluation form by its Bubble ID.
 */
export async function getEvalForm(id: string): Promise<BubbleEvalForm> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_FORM, id));
  return normalizeBubbleSingle<BubbleEvalForm>(raw);
}

// ─── Eval Form Settings ───────────────────────────────────────────────────────

/**
 * Fetches the EvalFormSettings record associated with a given form.
 * There is a 1:1 relationship between a form and its settings record.
 */
export async function getEvalFormSettings(
  formId: string,
): Promise<BubbleEvalFormSettings> {
  // First try direct lookup if we have a settings ID on the form
  const params = {
    constraints: buildConstraints({ 'Eval Form': formId }),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_FORM_SETTINGS), {
    params,
  });
  const list = normalizeBubbleList<BubbleEvalFormSettings>(raw);

  if (list.results.length === 0) {
    throw new Error(`No EvalFormSettings found for form ${formId}`);
  }

  return list.results[0];
}

// ─── Eval Categories ──────────────────────────────────────────────────────────

/**
 * Fetches all categories belonging to a given eval form, sorted by Rank.
 */
export async function getEvalCategories(
  formId: string,
): Promise<BubbleEvalCategory[]> {
  const params = {
    constraints: buildConstraints({ 'Eval Form': formId }),
    ...buildSortParams('Rank', true),
    limit: 100,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_CATEGORY), {
    params,
  });
  return normalizeBubbleList<BubbleEvalCategory>(raw).results;
}

// ─── Eval Category Attributes ─────────────────────────────────────────────────

/**
 * Fetches all scored attributes within a given category, sorted by Rank.
 */
export async function getEvalCategoryAttributes(
  categoryId: string,
): Promise<BubbleEvalCategoryAttribute[]> {
  const params = {
    constraints: buildConstraints({ Category: categoryId }),
    ...buildSortParams('Rank', true),
    limit: 100,
  };

  const raw = await get<unknown>(
    dataUrl(BUBBLE_TYPES.EVAL_CATEGORY_ATTRIBUTE),
    { params },
  );
  return normalizeBubbleList<BubbleEvalCategoryAttribute>(raw).results;
}

// ─── Eval Score Settings ──────────────────────────────────────────────────────

/**
 * Fetches the score settings (1–5 scale definitions) for an eval form.
 * Looks up via the Eval Form field on the score settings record.
 */
export async function getEvalScoreSettings(
  formId: string,
): Promise<BubbleEvalScoreSettings> {
  const params = {
    constraints: buildConstraints({ 'Eval Form': formId }),
    limit: 1,
  };

  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.EVAL_SCORE_SETTINGS), {
    params,
  });
  const list = normalizeBubbleList<BubbleEvalScoreSettings>(raw);

  if (list.results.length === 0) {
    throw new Error(`No EvalScoreSettings found for form ${formId}`);
  }

  return list.results[0];
}

/**
 * Fetches score settings by its direct Bubble ID.
 * Used when a form or attribute stores a direct reference to the settings record.
 */
export async function getEvalScoreSettingsById(
  id: string,
): Promise<BubbleEvalScoreSettings> {
  const raw = await get<unknown>(
    dataUrlById(BUBBLE_TYPES.EVAL_SCORE_SETTINGS, id),
  );
  return normalizeBubbleSingle<BubbleEvalScoreSettings>(raw);
}

// ─── Full Form Hydration ──────────────────────────────────────────────────────

/**
 * Fetches a complete form definition with categories and their attributes
 * resolved in a single tree structure.
 *
 * Makes multiple parallel requests to build the full structure efficiently.
 */
export async function getFullEvalForm(id: string): Promise<
  BubbleEvalForm & {
    Settings: BubbleEvalFormSettings;
    ScoreSettings: BubbleEvalScoreSettings;
    Categories: Array<
      BubbleEvalCategory & { Attributes: BubbleEvalCategoryAttribute[] }
    >;
  }
> {
  const form = await getEvalForm(id);

  const [settings, scoreSettings, categories] = await Promise.all([
    form['Form Settings']
      ? getEvalFormSettings(id)
      : Promise.resolve(null),
    form['Score Settings']
      ? getEvalScoreSettingsById(form['Score Settings'] as unknown as string)
      : getEvalScoreSettings(id).catch(() => null),
    getEvalCategories(id),
  ]);

  const attributesByCategory = await Promise.all(
    categories.map((cat) =>
      getEvalCategoryAttributes(cat._id).then((attrs) => ({
        ...cat,
        Attributes: attrs,
      })),
    ),
  );

  if (!settings) {
    throw new Error(`EvalFormSettings not found for form ${id}`);
  }
  if (!scoreSettings) {
    throw new Error(`EvalScoreSettings not found for form ${id}`);
  }

  return {
    ...form,
    Settings: settings,
    ScoreSettings: scoreSettings,
    Categories: attributesByCategory,
  };
}
