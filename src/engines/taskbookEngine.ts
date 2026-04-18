/**
 * taskbookEngine.ts
 * Taskbook engine — derives completion state from raw Bubble data.
 *
 * All computation is done in pure functions so the results can be memoised
 * by React Query and displayed without re-fetching.  No API calls are made
 * here; callers are responsible for fetching the underlying Bubble records.
 */

import type {
  BubbleProgramPhase,
  BubblePhaseRequirement,
  BubbleTaskbookLog,
  BubbleTask,
  BubbleAssessment,
  BubbleUser,
  TaskRequirementType,
} from '@/types';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * A single requirement within a phase, enriched with its completion state
 * derived from Bubble taskbook log records.
 */
export interface TaskbookItem {
  /** The raw BubblePhaseRequirement from Bubble */
  requirement: BubblePhaseRequirement;
  /** Discriminated type of the requirement (task, quiz, form, etc.) */
  requirementType: TaskRequirementType;
  /**
   * The most recent BubbleTaskbookLog for this requirement.
   * Undefined if the trainee has not yet attempted this requirement.
   */
  taskbookLog?: BubbleTaskbookLog;
  /** Whether this requirement is considered complete */
  isComplete: boolean;
  /**
   * Whether the completion has been co-signed by an evaluator.
   * Relevant only when the underlying task has Requires Cosign = true.
   */
  isSignedOff: boolean;
  /** Display name of the user who completed the requirement, if known */
  completedBy?: string;
  /** Timestamp of completion, derived from the taskbook log */
  completedAt?: Date;
  /** Number of attempts logged for this requirement */
  attemptCount: number;
  /**
   * The BubbleTask definition for task/skill requirements.
   * Undefined for quiz and assessment form requirements.
   */
  task?: BubbleTask;
  /**
   * The BubbleAssessment wrapper for assessment requirements.
   * Undefined for plain task/skill requirements.
   */
  assessment?: BubbleAssessment;
}

/**
 * Aggregated state for all requirements within a single BubbleProgramPhase.
 */
export interface TaskbookState {
  /** The phase these items belong to */
  phase: BubbleProgramPhase;
  /** All enriched requirement items for this phase */
  items: TaskbookItem[];
  /** Count of requirements that are fully complete (and signed off if required) */
  completedCount: number;
  /** Total number of required requirements in this phase */
  totalCount: number;
  /** Completion percentage (0–100, rounded integer) */
  percentComplete: number;
  /** True when all required requirements are complete */
  isPhaseComplete: boolean;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds a fully enriched TaskbookState from raw Bubble data.
 *
 * @param phase           The program phase to compute state for
 * @param requirements    All BubblePhaseRequirement records for this phase
 * @param taskbookLogs    All BubbleTaskbookLog records for this subject in this phase
 * @param tasks           All BubbleTask definitions relevant to this phase
 * @param assessments     All BubbleAssessment definitions relevant to this phase
 */
export function buildTaskbookState(
  phase: BubbleProgramPhase,
  requirements: BubblePhaseRequirement[],
  taskbookLogs: BubbleTaskbookLog[],
  tasks: BubbleTask[],
  assessments: BubbleAssessment[],
): TaskbookState {
  // Sort requirements by Rank ascending
  const sortedRequirements = [...requirements].sort((a, b) => a.Rank - b.Rank);

  const items: TaskbookItem[] = sortedRequirements.map((requirement) => {
    const requirementType = determineRequirementType(requirement);
    const taskbookLog = getRequirementLog(requirement, taskbookLogs);
    const task = getTaskForRequirement(requirement, tasks);
    const assessment = getAssessmentForRequirement(requirement, assessments);

    // Compute completion: must have a log AND that log's Success flag must be true
    const isComplete = taskbookLog !== undefined && taskbookLog.Success;

    // Signed off = complete AND either no cosign required, or cosign was provided
    const requiresCosign = task?.['Requires Cosign'] ?? false;
    const isSignedOff = isComplete && (!requiresCosign || taskbookLog?.['Cosign Pending'] === false);

    const completedAt =
      taskbookLog?.['Completed At']
        ? new Date(taskbookLog['Completed At'])
        : undefined;

    // Count all logs for this requirement across all attempts
    const allLogsForRequirement = taskbookLogs.filter(
      (log) => log.Requirement === requirement._id,
    );
    const attemptCount = allLogsForRequirement.length;

    return {
      requirement,
      requirementType,
      taskbookLog,
      isComplete,
      isSignedOff,
      completedBy: taskbookLog?.['Completed By'],
      completedAt,
      attemptCount,
      task,
      assessment,
    };
  });

  // Only required requirements count toward phase completion
  const requiredItems = items.filter((item) => {
    const requiresCosign = item.task?.['Requires Cosign'] ?? false;
    // An item is "done" when complete and signed off (if cosign needed)
    return item.requirement['Is Task'] || item.requirement['Is Skill']
      ? true // all tasks/skills are required unless we add an optional flag later
      : true; // assessments and quizzes are always required
  });

  const completedCount = items.filter((item) => {
    const requiresCosign = item.task?.['Requires Cosign'] ?? false;
    return requiresCosign ? item.isSignedOff : item.isComplete;
  }).length;

  const totalCount = items.length;

  const percentComplete =
    totalCount === 0
      ? 100
      : Math.round((completedCount / totalCount) * 100);

  const isPhaseComplete = totalCount > 0 && completedCount === totalCount;

  return {
    phase,
    items,
    completedCount,
    totalCount,
    percentComplete,
    isPhaseComplete,
  };
}

// ─── Type discriminator ───────────────────────────────────────────────────────

/**
 * Determines the TaskRequirementType for a BubblePhaseRequirement.
 *
 * Reads the boolean flags on the requirement in priority order:
 *   skill > task > assessment_quiz > assessment_form > assignment
 * Falls back to 'task' if no flag is set (defensive default).
 */
export function determineRequirementType(
  requirement: BubblePhaseRequirement,
): TaskRequirementType {
  if (requirement['Is Skill']) return 'skill';
  if (requirement['Is Task']) return 'task';
  if (requirement['Is Assessment Quiz']) return 'assessment_quiz';
  if (requirement['Is Assessment Form']) return 'assessment_form';
  if (requirement['Is Assignment']) return 'assignment';
  // Defensive fallback
  return 'task';
}

// ─── Log lookup ───────────────────────────────────────────────────────────────

/**
 * Finds the most recent BubbleTaskbookLog for a given requirement.
 *
 * When multiple logs exist (re-attempts), the one with the highest
 * Attempt Number is returned.  Returns undefined if no log exists yet.
 */
export function getRequirementLog(
  requirement: BubblePhaseRequirement,
  logs: BubbleTaskbookLog[],
): BubbleTaskbookLog | undefined {
  const matchingLogs = logs.filter(
    (log) => log.Requirement === requirement._id,
  );

  if (matchingLogs.length === 0) return undefined;

  // Return the attempt with the highest attempt number
  return matchingLogs.reduce<BubbleTaskbookLog | undefined>((best, log) => {
    if (!best) return log;
    return log['Attempt Number'] > best['Attempt Number'] ? log : best;
  }, undefined);
}

// ─── Permission check ─────────────────────────────────────────────────────────

/**
 * Returns true if the given user is permitted to check off (sign off on)
 * the given requirement.
 *
 * Rules:
 *  - Evaluators and admins can always check off requirements
 *  - Reviewers can check off but only if the requirement has cosign pending
 *  - Subjects (trainees) can never check off their own requirements
 *    (they can mark self-report tasks via the API, but that's handled separately)
 */
export function canEvaluatorCheckOff(
  requirement: BubblePhaseRequirement,
  user: BubbleUser,
): boolean {
  const role = user['APEx Role'];

  switch (role) {
    case 'admin':
      return true;

    case 'evaluator':
      // Evaluators can check off all task types
      return (
        requirement['Is Task'] ||
        requirement['Is Skill'] ||
        requirement['Is Assessment Form'] ||
        requirement['Is Assessment Quiz'] ||
        requirement['Is Assignment']
      );

    case 'reviewer':
      // Reviewers can co-sign but not directly check off — return true only
      // for cosign-eligible task types (skill/task)
      return requirement['Is Skill'] || requirement['Is Task'];

    case 'subject':
      // Subjects cannot check off their own requirements via evaluator action
      return false;

    default:
      return false;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Finds the BubbleTask referenced by a task or skill requirement. */
function getTaskForRequirement(
  requirement: BubblePhaseRequirement,
  tasks: BubbleTask[],
): BubbleTask | undefined {
  if (!requirement['Task Ref']) return undefined;
  return tasks.find((t) => t._id === requirement['Task Ref']);
}

/** Finds the BubbleAssessment referenced by an assessment requirement. */
function getAssessmentForRequirement(
  requirement: BubblePhaseRequirement,
  assessments: BubbleAssessment[],
): BubbleAssessment | undefined {
  if (!requirement['Assessment Ref']) return undefined;
  return assessments.find((a) => a._id === requirement['Assessment Ref']);
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

/**
 * Returns all TaskbookItems that are currently incomplete and not signed off.
 * Useful for rendering "remaining tasks" lists.
 */
export function getPendingItems(state: TaskbookState): TaskbookItem[] {
  return state.items.filter((item) => {
    const requiresCosign = item.task?.['Requires Cosign'] ?? false;
    return requiresCosign ? !item.isSignedOff : !item.isComplete;
  });
}

/**
 * Returns all TaskbookItems that need a cosign (complete but not yet signed).
 */
export function getItemsAwaitingCosign(state: TaskbookState): TaskbookItem[] {
  return state.items.filter(
    (item) => item.isComplete && !item.isSignedOff && (item.task?.['Requires Cosign'] ?? false),
  );
}

/**
 * Returns task items grouped by whether they are complete.
 */
export function groupItemsByCompletion(state: TaskbookState): {
  complete: TaskbookItem[];
  incomplete: TaskbookItem[];
} {
  const complete: TaskbookItem[] = [];
  const incomplete: TaskbookItem[] = [];

  for (const item of state.items) {
    const requiresCosign = item.task?.['Requires Cosign'] ?? false;
    const isDone = requiresCosign ? item.isSignedOff : item.isComplete;
    if (isDone) {
      complete.push(item);
    } else {
      incomplete.push(item);
    }
  }

  return { complete, incomplete };
}
