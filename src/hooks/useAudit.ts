/**
 * useAudit.ts
 * Audit hook — provides bound audit logging functions with the current user
 * automatically injected.
 *
 * All audit writes go to the Bubble User Logs data type via the Bubble
 * workflow API so that server-side validation and enrichment can occur.
 * The calls are fire-and-forget; failures are swallowed and logged in dev
 * so audit errors never block user-facing actions.
 *
 * Usage:
 *   const audit = useAudit();
 *   audit.logEvalCreated(formLog._id);
 *   audit.logScoreEntered(formLog._id, attributeId, score);
 */

import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { post } from '@/api/client';
import { BUBBLE_TYPES, dataUrl } from '@/api/bubble';
import type { LogAction, BubbleUserLog } from '@/types';

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Sends a log entry to the Bubble User Logs data type.
 * Errors are intentionally swallowed after DEV logging — audit failures
 * should never prevent the user from completing their work.
 */
async function writeLog(
  payload: Partial<BubbleUserLog>,
): Promise<void> {
  try {
    await post<unknown>(dataUrl(BUBBLE_TYPES.USER_LOG), payload);
  } catch (error) {
    if (__DEV__) {
      console.warn('[useAudit] Failed to write audit log:', error, payload);
    }
    // Intentionally swallowed — audit errors are non-blocking
  }
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseAuditReturn {
  /**
   * Logs an evaluation being created.
   * @param evalLogId Bubble _id of the new BubbleEvalFormLog
   */
  logEvalCreated: (evalLogId: string) => void;

  /**
   * Logs an individual attribute score being entered for the first time.
   * @param evalLogId   Bubble _id of the BubbleEvalFormLog
   * @param attributeId Bubble _id of the BubbleEvalCategoryAttribute
   * @param score       Numeric score value entered
   */
  logScoreEntered: (evalLogId: string, attributeId: string, score: number) => void;

  /**
   * Logs an existing attribute score being updated.
   * @param evalLogId   Bubble _id of the BubbleEvalFormLog
   * @param attributeId Bubble _id of the BubbleEvalCategoryAttribute
   * @param oldScore    Previous score value
   * @param newScore    New score value
   */
  logScoreUpdated: (
    evalLogId: string,
    attributeId: string,
    oldScore: number,
    newScore: number,
  ) => void;

  /**
   * Logs a workflow step being completed (approved/returned/disputed).
   * @param evalLogId Bubble _id of the BubbleEvalFormLog
   * @param stepId    Bubble _id of the BubbleFormWorkflowStep
   * @param action    The action taken at this step
   */
  logStepCompleted: (evalLogId: string, stepId: string, action: string) => void;

  /**
   * Logs a task or skill being checked off in the taskbook.
   * @param requirementId Bubble _id of the BubblePhaseRequirement
   * @param rosterId      Bubble _id of the BubbleProgramRoster
   * @param taskName      Display name of the task (for the audit text)
   */
  logTaskCheckedOff: (requirementId: string, rosterId: string, taskName: string) => void;

  /**
   * Logs a progress note being added.
   * @param noteId    Bubble _id of the BubbleProgressNote
   * @param subjectId Bubble _id of the subject the note is about
   */
  logNoteAdded: (noteId: string, subjectId: string) => void;

  /**
   * Logs a quiz/assessment being submitted.
   * @param quizId    Bubble _id of the BubbleQuiz
   * @param resultId  Bubble _id of the BubbleTestResult
   * @param passed    Whether the submission passed
   */
  logAssessmentSubmitted: (quizId: string, resultId: string, passed: boolean) => void;

  /**
   * Logs a generic action with a custom audit description.
   * Use sparingly — prefer the typed log functions above.
   */
  logCustom: (action: LogAction, auditText: string, entityRef?: string, entityType?: string) => void;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useAudit(): UseAuditReturn {
  const user = useAuthStore((state) => state.user);

  // Build and dispatch a log entry with the current user pre-filled
  const dispatch = useCallback(
    (
      action: LogAction,
      auditText: string,
      extra: Partial<BubbleUserLog> = {},
    ): void => {
      if (!user) return;

      void writeLog({
        Action: action,
        Audit: auditText,
        'Completed By': user._id,
        'Is Eval': false,
        Expanded: false,
        ...extra,
      });
    },
    [user],
  );

  // ── Bound log functions ────────────────────────────────────────────────────

  const logEvalCreated = useCallback(
    (evalLogId: string): void => {
      dispatch(
        'eval_created',
        `Evaluation created by ${user?.['First Name'] ?? 'user'} ${user?.['Last Name'] ?? ''}`.trim(),
        {
          'Is Eval': true,
          'Eval Ref': evalLogId,
          'Entity Ref': evalLogId,
          'Entity Type': 'EvalFormLog',
          Expanded: false,
        },
      );
    },
    [dispatch, user],
  );

  const logScoreEntered = useCallback(
    (evalLogId: string, attributeId: string, score: number): void => {
      dispatch(
        'eval_score_updated',
        `Score ${score} entered for attribute ${attributeId}`,
        {
          'Is Eval': true,
          'Eval Ref': evalLogId,
          'Entity Ref': evalLogId,
          'Entity Type': 'EvalFormLog',
          Content: { attributeId, score, type: 'entered' },
        },
      );
    },
    [dispatch],
  );

  const logScoreUpdated = useCallback(
    (
      evalLogId: string,
      attributeId: string,
      oldScore: number,
      newScore: number,
    ): void => {
      dispatch(
        'eval_score_updated',
        `Score updated from ${oldScore} to ${newScore} for attribute ${attributeId}`,
        {
          'Is Eval': true,
          'Eval Ref': evalLogId,
          'Entity Ref': evalLogId,
          'Entity Type': 'EvalFormLog',
          Content: { attributeId, oldScore, newScore, type: 'updated' },
        },
      );
    },
    [dispatch],
  );

  const logStepCompleted = useCallback(
    (evalLogId: string, stepId: string, action: string): void => {
      dispatch(
        'workflow_step_actioned',
        `Workflow step ${stepId} actioned with "${action}"`,
        {
          'Is Eval': true,
          'Eval Ref': evalLogId,
          'Entity Ref': evalLogId,
          'Entity Type': 'EvalFormLog',
          Content: { stepId, action },
          Expanded: true, // Workflow step changes are notable in the audit log
        },
      );
    },
    [dispatch],
  );

  const logTaskCheckedOff = useCallback(
    (requirementId: string, rosterId: string, taskName: string): void => {
      dispatch(
        'task_completed',
        `Task "${taskName}" checked off by ${user?.['First Name'] ?? 'user'} ${user?.['Last Name'] ?? ''}`.trim(),
        {
          'Entity Ref': requirementId,
          'Entity Type': 'PhaseRequirement',
          Content: { requirementId, rosterId, taskName },
        },
      );
    },
    [dispatch, user],
  );

  const logNoteAdded = useCallback(
    (noteId: string, subjectId: string): void => {
      dispatch(
        'note_created',
        `Progress note added for subject ${subjectId}`,
        {
          'Entity Ref': noteId,
          'Entity Type': 'ProgressNote',
          'Target User': subjectId,
          Content: { noteId, subjectId },
        },
      );
    },
    [dispatch],
  );

  const logAssessmentSubmitted = useCallback(
    (quizId: string, resultId: string, passed: boolean): void => {
      const action: LogAction = passed ? 'quiz_passed' : 'quiz_failed';
      dispatch(
        action,
        `Quiz ${quizId} submitted — ${passed ? 'PASSED' : 'FAILED'}`,
        {
          'Entity Ref': resultId,
          'Entity Type': 'TestResult',
          Content: { quizId, resultId, passed },
        },
      );
    },
    [dispatch],
  );

  const logCustom = useCallback(
    (
      action: LogAction,
      auditText: string,
      entityRef?: string,
      entityType?: string,
    ): void => {
      dispatch(action, auditText, {
        'Entity Ref': entityRef,
        'Entity Type': entityType,
      });
    },
    [dispatch],
  );

  return {
    logEvalCreated,
    logScoreEntered,
    logScoreUpdated,
    logStepCompleted,
    logTaskCheckedOff,
    logNoteAdded,
    logAssessmentSubmitted,
    logCustom,
  };
}
