/**
 * evaluationRenderer.ts
 * Schema-driven evaluation renderer engine.
 *
 * Builds a fully rendered, UI-ready evaluation form from raw Bubble schema
 * objects.  All scoring configuration (ranges, labels, colors, feedback rules)
 * is derived dynamically from BubbleEvalScoreSettings — nothing is hardcoded.
 */

import type {
  BubbleEvalForm,
  BubbleEvalFormSettings,
  BubbleEvalCategory,
  BubbleEvalCategoryAttribute,
  BubbleEvalScoreSettings,
  BubbleEvalScoreLog,
} from '@/types';

// ─── Public interface types ───────────────────────────────────────────────────

export interface ScoreOption {
  value: number;
  label: string;
  color: string;
  requiresFeedback: boolean;
}

export interface RenderedAttribute {
  id: string;
  name: string;
  description: string;
  scoreOptions: ScoreOption[];
  isRequired: boolean;
  excludeFromScore: boolean;
  commentsRequired: boolean;
  currentScore?: number;
  currentNotes?: string;
  isNotApplicable: boolean;
  scoreLogId?: string;
}

export interface RenderedCategory {
  id: string;
  name: string;
  description: string;
  attributes: RenderedAttribute[];
  averageScore?: number;
  rank: number;
}

export interface RenderedEvalForm {
  formId: string;
  formName: string;
  formDescription: string;
  categories: RenderedCategory[];
  allowDispute: boolean;
  showProgress: boolean;
  isShiftEval: boolean;
  isCallEval: boolean;
  assessmentsOn: boolean;
  requirePassingScore: boolean;
  minimumPassingScore: number;
  overallCommentRequired: boolean;
  subjectCanViewScores: boolean;
}

// ─── Score option builder ─────────────────────────────────────────────────────

/**
 * Builds an array of ScoreOption from the Bubble score settings record.
 * The scale is defined by Value1–Value5; any value without a name is excluded.
 * This is intentionally generic — it adapts to whatever labels/colors Bubble
 * has configured rather than assuming a 1–5 "exceeds/meets/below" scale.
 */
export function buildScoreOptions(
  scoreSettings: BubbleEvalScoreSettings,
): ScoreOption[] {
  const options: ScoreOption[] = [];

  const valueCount = 5; // Bubble schema supports up to 5 score levels

  for (let n = 1; n <= valueCount; n++) {
    const nameKey = `Value${n} Name` as keyof BubbleEvalScoreSettings;
    const colorKey = `Value${n} Color` as keyof BubbleEvalScoreSettings;
    const feedbackKey =
      `Value${n} Feedback Required` as keyof BubbleEvalScoreSettings;

    const label = scoreSettings[nameKey] as string | undefined;
    if (!label || label.trim() === '') {
      // Skip undefined or empty score levels
      continue;
    }

    options.push({
      value: n,
      label: label.trim(),
      color: (scoreSettings[colorKey] as string | undefined) ?? '#94A3B8',
      requiresFeedback:
        (scoreSettings[feedbackKey] as boolean | undefined) ?? false,
    });
  }

  return options;
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Finds the score log entry for a given attribute within a form log. */
function findScoreLog(
  attributeId: string,
  existingScoreLogs: BubbleEvalScoreLog[],
): BubbleEvalScoreLog | undefined {
  return existingScoreLogs.find(
    (log) => log['Eval Attribute'] === attributeId,
  );
}

/** Computes the average score for a category (excluding NA and score-excluded attributes). */
function computeCategoryAverage(attributes: RenderedAttribute[]): number | undefined {
  const scoreable = attributes.filter(
    (a) => !a.isNotApplicable && !a.excludeFromScore && a.currentScore !== undefined,
  );
  if (scoreable.length === 0) return undefined;
  const total = scoreable.reduce((sum, a) => sum + (a.currentScore ?? 0), 0);
  return total / scoreable.length;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds a RenderedEvalForm from all Bubble schema and runtime data.
 *
 * @param form              The EvalForm template record
 * @param settings          BubbleEvalFormSettings controlling behavior flags
 * @param categories        All BubbleEvalCategory records for this form
 * @param attributesByCategory  Map of categoryId → its BubbleEvalCategoryAttribute[]
 * @param scoreSettings     The score scale definition for this form
 * @param existingScoreLogs Any BubbleEvalScoreLog records already saved
 */
export function buildRenderedForm(
  form: BubbleEvalForm,
  settings: BubbleEvalFormSettings,
  categories: BubbleEvalCategory[],
  attributesByCategory: Record<string, BubbleEvalCategoryAttribute[]>,
  scoreSettings: BubbleEvalScoreSettings,
  existingScoreLogs: BubbleEvalScoreLog[],
): RenderedEvalForm {
  const scoreOptions = buildScoreOptions(scoreSettings);

  // Sort categories by Rank ascending
  const sortedCategories = [...categories].sort((a, b) => a.Rank - b.Rank);

  const renderedCategories: RenderedCategory[] = sortedCategories.map(
    (category) => {
      const rawAttributes = attributesByCategory[category._id] ?? [];

      // Sort attributes by Rank ascending within each category
      const sortedAttributes = [...rawAttributes].sort(
        (a, b) => a.Rank - b.Rank,
      );

      const renderedAttributes: RenderedAttribute[] = sortedAttributes.map(
        (attr) => {
          const scoreLog = findScoreLog(attr._id, existingScoreLogs);
          return {
            id: attr._id,
            name: attr['Attribute Name'],
            description: attr.Description ?? '',
            scoreOptions,
            isRequired: true, // All attributes are scored unless excluded
            excludeFromScore: attr['Exclude from Score'] ?? false,
            commentsRequired: attr['Comments Required'] ?? false,
            currentScore:
              scoreLog?.Score !== null && scoreLog?.Score !== undefined
                ? scoreLog.Score
                : undefined,
            currentNotes: scoreLog?.Comments,
            isNotApplicable: scoreLog?.['Not Applicable'] ?? false,
            scoreLogId: scoreLog?._id,
          };
        },
      );

      return {
        id: category._id,
        name: category['Category Name'],
        description: category.Description ?? '',
        attributes: renderedAttributes,
        averageScore: computeCategoryAverage(renderedAttributes),
        rank: category.Rank,
      };
    },
  );

  return {
    formId: form._id,
    formName: form['Form Name'],
    formDescription: form.Description ?? '',
    categories: renderedCategories,
    allowDispute: settings['Allow Dispute'],
    showProgress: true,
    // A form is considered a "shift eval" if it has a shift schedule association
    // (determined at the form-log level, not the form template level)
    isShiftEval: false,
    isCallEval: false,
    assessmentsOn: false,
    requirePassingScore: settings['Require Passing Score'],
    minimumPassingScore: settings['Minimum Passing Score'] ?? 0,
    overallCommentRequired: settings['Overall Comment Required'],
    subjectCanViewScores: settings['Subject Can View Scores'],
  };
}

// ─── Completion helpers ───────────────────────────────────────────────────────

/**
 * Returns true when every required (non-excluded) attribute in the form has
 * a score or has been marked Not Applicable.
 */
export function isFormComplete(rendered: RenderedEvalForm): boolean {
  for (const category of rendered.categories) {
    for (const attribute of category.attributes) {
      if (attribute.excludeFromScore) continue;
      if (attribute.isNotApplicable) continue;
      if (attribute.currentScore === undefined) return false;
    }
  }
  return true;
}

/**
 * Returns the percentage of scoreable attributes that have been scored.
 * Excludes score-excluded and NA attributes from both numerator and denominator.
 */
export function getCompletionPercentage(rendered: RenderedEvalForm): number {
  let total = 0;
  let scored = 0;

  for (const category of rendered.categories) {
    for (const attribute of category.attributes) {
      if (attribute.excludeFromScore) continue;
      if (attribute.isNotApplicable) {
        // NA attributes count as "done"
        total += 1;
        scored += 1;
        continue;
      }
      total += 1;
      if (attribute.currentScore !== undefined) {
        scored += 1;
      }
    }
  }

  if (total === 0) return 100;
  return Math.round((scored / total) * 100);
}

/**
 * Returns true if the given score value requires the evaluator to enter
 * feedback text before the form can be submitted.
 */
export function scoreRequiresFeedback(
  scoreSettings: BubbleEvalScoreSettings,
  scoreValue: number,
): boolean {
  if (scoreValue < 1 || scoreValue > 5) return false;
  const feedbackKey =
    `Value${scoreValue} Feedback Required` as keyof BubbleEvalScoreSettings;
  return (scoreSettings[feedbackKey] as boolean | undefined) ?? false;
}

// ─── Optimistic UI merge ──────────────────────────────────────────────────────

/**
 * Returns a new RenderedEvalForm with the given attribute score merged in.
 * Used for optimistic UI updates so the form reflects the user's input
 * immediately before the API call completes.
 *
 * This is a pure function — it does not mutate the original form.
 */
export function mergeScoreUpdate(
  rendered: RenderedEvalForm,
  categoryId: string,
  attributeId: string,
  score: number,
  notes?: string,
): RenderedEvalForm {
  const updatedCategories = rendered.categories.map((category) => {
    if (category.id !== categoryId) return category;

    const updatedAttributes = category.attributes.map((attribute) => {
      if (attribute.id !== attributeId) return attribute;
      return {
        ...attribute,
        currentScore: score,
        currentNotes: notes ?? attribute.currentNotes,
        isNotApplicable: false,
      };
    });

    return {
      ...category,
      attributes: updatedAttributes,
      averageScore: computeCategoryAverage(updatedAttributes),
    };
  });

  return {
    ...rendered,
    categories: updatedCategories,
  };
}

/**
 * Returns a new RenderedEvalForm with the given attribute marked as
 * Not Applicable (score cleared, NA flag set).
 */
export function mergeNotApplicableUpdate(
  rendered: RenderedEvalForm,
  categoryId: string,
  attributeId: string,
): RenderedEvalForm {
  const updatedCategories = rendered.categories.map((category) => {
    if (category.id !== categoryId) return category;

    const updatedAttributes = category.attributes.map((attribute) => {
      if (attribute.id !== attributeId) return attribute;
      return {
        ...attribute,
        currentScore: undefined,
        isNotApplicable: true,
      };
    });

    return {
      ...category,
      attributes: updatedAttributes,
      averageScore: computeCategoryAverage(updatedAttributes),
    };
  });

  return {
    ...rendered,
    categories: updatedCategories,
  };
}

/**
 * Computes the overall average score across the entire form.
 * Excludes NA and score-excluded attributes.
 * Returns undefined if no attributes have been scored.
 */
export function computeFormOverallScore(
  rendered: RenderedEvalForm,
): number | undefined {
  const allAttributes = rendered.categories.flatMap((c) => c.attributes);
  const scoreable = allAttributes.filter(
    (a) => !a.isNotApplicable && !a.excludeFromScore && a.currentScore !== undefined,
  );
  if (scoreable.length === 0) return undefined;
  const total = scoreable.reduce((sum, a) => sum + (a.currentScore ?? 0), 0);
  return total / scoreable.length;
}
