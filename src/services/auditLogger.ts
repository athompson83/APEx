/**
 * auditLogger.ts
 * Audit log service — creates BubbleUserLog records for significant user
 * actions throughout the app.
 *
 * Queue-based: if the device is offline when an action occurs, the log entry
 * is queued in AsyncStorage via offlineQueue.ts and flushed when connectivity
 * is restored. This ensures no audit events are lost due to network conditions.
 *
 * Pattern: each exported function is a named log-event factory that sets the
 * correct LogAction value and structures the Content/Audit fields.
 */

import { createUserLog } from '../api/endpoints/userLogs';
import { enqueue } from './offlineQueue';
import { BUBBLE_TYPES, dataUrl } from '../api/bubble';
import type { BubbleUserLog, LogAction } from '../types/userLog';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Attempts to write an audit log entry to Bubble immediately.
 * If the write fails (e.g. offline or server error), the entry is queued
 * for later delivery via offlineQueue.
 *
 * Errors are never re-thrown — audit logging must never block user workflows.
 */
async function logEvent(
  action: LogAction,
  details: Partial<BubbleUserLog>,
): Promise<void> {
  try {
    await createUserLog(action, details);
  } catch (err) {
    if (__DEV__) {
      console.warn(
        `[APEx:AuditLogger] Network error — queuing offline: ${action}`,
        details,
        err,
      );
    }

    try {
      await enqueue({
        method: 'POST',
        url: dataUrl(BUBBLE_TYPES.USER_LOG),
        data: {
          Action: action,
          ...details,
        },
        maxRetries: 5,
      });
    } catch (queueErr) {
      // Last resort — we cannot queue either. Log to console only.
      console.error(
        '[APEx:AuditLogger] Failed to queue audit log event:',
        { action, details },
        queueErr,
      );
    }
  }
}

// ─── Audit Events ─────────────────────────────────────────────────────────────

/**
 * Logs that a new evaluation was created.
 *
 * @param evalId   - Bubble _id of the newly created EvalFormLog
 * @param userId   - Bubble _id of the user who created the evaluation
 */
export async function logEvalCreated(
  evalId: string,
  userId: string,
): Promise<void> {
  await logEvent('eval_created', {
    'Completed By': userId,
    'Is Eval': true,
    'Eval Ref': evalId,
    'Entity Ref': evalId,
    'Entity Type': 'EvalFormLog',
    Audit: `Evaluation created (ID: ${evalId})`,
    Expanded: false,
    Content: { evalId },
  });
}

/**
 * Logs that a score was entered for a category attribute.
 *
 * @param evalId      - Bubble _id of the EvalFormLog
 * @param categoryId  - Bubble _id of the EvalCategory
 * @param score       - Numeric score value entered (1–5)
 * @param userId      - Bubble _id of the user who entered the score
 */
export async function logScoreEntered(
  evalId: string,
  categoryId: string,
  score: number,
  userId: string,
): Promise<void> {
  await logEvent('eval_score_updated', {
    'Completed By': userId,
    'Is Eval': true,
    'Eval Ref': evalId,
    'Entity Ref': evalId,
    'Entity Type': 'EvalFormLog',
    Audit: `Score ${score} entered for category ${categoryId} on eval ${evalId}`,
    Expanded: false,
    Content: { evalId, categoryId, score, type: 'initial' },
  });
}

/**
 * Logs that an existing score was updated.
 *
 * @param evalId      - Bubble _id of the EvalFormLog
 * @param categoryId  - Bubble _id of the EvalCategory
 * @param score       - New numeric score value
 * @param userId      - Bubble _id of the user who updated the score
 */
export async function logScoreUpdated(
  evalId: string,
  categoryId: string,
  score: number,
  userId: string,
): Promise<void> {
  await logEvent('eval_score_updated', {
    'Completed By': userId,
    'Is Eval': true,
    'Eval Ref': evalId,
    'Entity Ref': evalId,
    'Entity Type': 'EvalFormLog',
    Audit: `Score updated to ${score} for category ${categoryId} on eval ${evalId}`,
    Expanded: false,
    Content: { evalId, categoryId, score, type: 'update' },
  });
}

/**
 * Logs that a workflow step was actioned (submit, approve, dispute, return).
 *
 * @param evalId   - Bubble _id of the EvalFormLog
 * @param stepId   - Bubble _id of the BubbleFormWorkflowStep
 * @param action   - The WorkflowAction taken (as a string)
 * @param userId   - Bubble _id of the user who actioned the step
 */
export async function logStepCompleted(
  evalId: string,
  stepId: string,
  action: string,
  userId: string,
): Promise<void> {
  await logEvent('workflow_step_actioned', {
    'Completed By': userId,
    'Is Eval': true,
    'Eval Ref': evalId,
    'Entity Ref': evalId,
    'Entity Type': 'EvalFormLog',
    Audit: `Workflow step ${stepId} actioned with '${action}' on eval ${evalId}`,
    Expanded: action === 'dispute' || action === 'return',
    Content: { evalId, stepId, action },
  });
}

/**
 * Logs that a task was checked off in a trainee's taskbook.
 *
 * @param taskId    - Bubble _id of the Task definition
 * @param rosterId  - Bubble _id of the ProgramRoster entry (not used as key field
 *                    since TaskbookLog uses Phase/Program, but kept for context)
 * @param userId    - Bubble _id of the user who marked the task complete
 */
export async function logTaskCheckedOff(
  taskId: string,
  rosterId: string,
  userId: string,
): Promise<void> {
  await logEvent('task_completed', {
    'Completed By': userId,
    'Is Eval': false,
    'Entity Ref': taskId,
    'Entity Type': 'Task',
    Audit: `Task ${taskId} marked complete (roster: ${rosterId})`,
    Expanded: false,
    Content: { taskId, rosterId },
  });
}

/**
 * Logs that a progress note was added for a subject.
 *
 * @param noteId     - Bubble _id of the newly created ProgressNote
 * @param subjectId  - Bubble _id of the subject the note is about
 * @param userId     - Bubble _id of the note creator
 */
export async function logNoteAdded(
  noteId: string,
  subjectId: string,
  userId: string,
): Promise<void> {
  await logEvent('note_created', {
    'Completed By': userId,
    'Target User': subjectId,
    'Is Eval': false,
    'Entity Ref': noteId,
    'Entity Type': 'ProgressNote',
    Audit: `Progress note created for subject ${subjectId} (note: ${noteId})`,
    Expanded: false,
    Content: { noteId, subjectId },
  });
}

/**
 * Logs that an assessment (quiz) was submitted.
 *
 * @param assessmentId - Bubble _id of the TestResult record
 * @param userId       - Bubble _id of the user who submitted the assessment
 */
export async function logAssessmentSubmitted(
  assessmentId: string,
  userId: string,
): Promise<void> {
  await logEvent('quiz_submitted', {
    'Completed By': userId,
    'Is Eval': false,
    'Entity Ref': assessmentId,
    'Entity Type': 'TestResult',
    Audit: `Quiz/assessment submitted (result ID: ${assessmentId})`,
    Expanded: false,
    Content: { assessmentId },
  });
}

/**
 * Logs a user login event.
 *
 * @param userId - Bubble _id of the user who logged in
 */
export async function logLogin(userId: string): Promise<void> {
  await logEvent('auth_login', {
    'Completed By': userId,
    'Is Eval': false,
    Expanded: false,
    Audit: `User ${userId} signed in`,
    Content: { timestamp: new Date().toISOString() },
  });
}

/**
 * Logs a user logout event.
 *
 * @param userId - Bubble _id of the user who logged out
 */
export async function logLogout(userId: string): Promise<void> {
  await logEvent('auth_logout', {
    'Completed By': userId,
    'Is Eval': false,
    Expanded: false,
    Audit: `User ${userId} signed out`,
    Content: { timestamp: new Date().toISOString() },
  });
}
