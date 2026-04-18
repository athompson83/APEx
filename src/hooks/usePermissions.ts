/**
 * usePermissions.ts
 * Permissions hook — derives contextual access rights for the current user.
 *
 * Delegates all business logic to permissionService so this hook is a thin
 * reactive wrapper.  The return value is memoised: it only changes when the
 * user, formLog, or formSettings change.
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import * as permissionService from '@/services/permissionService';
import type { BubbleEvalFormLog, BubbleEvalFormSettings } from '@/types';
import type { BubbleFormWorkflowStep } from '@/types';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UsePermissionsReturn {
  /** Whether the user can enter or modify scores on the form log */
  canEdit: boolean;
  /**
   * Whether the user can approve the current workflow step.
   * Requires a currentStep to be passed; false if omitted.
   */
  canApprove: boolean;
  /**
   * Whether the user can raise a dispute on the form log.
   * Requires both formLog and formSettings; always false if omitted.
   */
  canDispute: boolean;
  /**
   * Whether the user can create a new eval using the current form settings.
   * Requires formSettings; always false if omitted.
   */
  canCreateEval: boolean;
  /** True if the current user is the subject of the form log */
  isSubject: boolean;
  /** True if the current user is the evaluator on the form log */
  isEvaluator: boolean;
  /** True if the current user holds a reviewer or admin role */
  isReviewer: boolean;
  /**
   * True if the current user can see scores on this evaluation.
   * Requires formLog and formSettings.
   */
  canViewScores: boolean;
  /**
   * True if the current user can create a self-evaluation.
   * Requires formSettings.
   */
  canSelfEval: boolean;
  /** The most contextually appropriate role for this user + eval combination */
  effectiveRole: ReturnType<typeof permissionService.getEffectiveRole>;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

/**
 * @param formLog       The evaluation log for context-aware checks (optional)
 * @param formSettings  The form settings record for creation/dispute checks (optional)
 * @param currentStep   The current workflow step for approval checks (optional)
 */
export function usePermissions(
  formLog?: BubbleEvalFormLog,
  formSettings?: BubbleEvalFormSettings,
  currentStep?: BubbleFormWorkflowStep,
): UsePermissionsReturn {
  const user = useAuthStore((state) => state.user);

  return useMemo<UsePermissionsReturn>(() => {
    // No user = no permissions
    if (!user) {
      return {
        canEdit: false,
        canApprove: false,
        canDispute: false,
        canCreateEval: false,
        isSubject: false,
        isEvaluator: false,
        isReviewer: false,
        canViewScores: false,
        canSelfEval: false,
        effectiveRole: 'subject',
      };
    }

    const canEdit = formLog
      ? permissionService.canEditScores(user, formLog)
      : false;

    const canApprove =
      formLog && currentStep
        ? permissionService.canApprove(user, currentStep, formLog)
        : false;

    const canDispute =
      formLog && formSettings
        ? permissionService.canDispute(user, formLog, formSettings)
        : false;

    const canCreateEval = formSettings
      ? permissionService.canCreateEval(user, formSettings)
      : false;

    const isSubjectFlag = formLog
      ? permissionService.isSubject(user, formLog)
      : false;

    const isEvaluatorFlag = formLog
      ? permissionService.isEvaluator(user, formLog)
      : false;

    const isReviewerFlag = permissionService.isReviewer(user);

    const canViewScores =
      formLog && formSettings
        ? permissionService.canViewOwnScores(user, formLog, formSettings)
        : false;

    const canSelfEvalFlag = formSettings
      ? permissionService.canSelfEval(user, formSettings)
      : false;

    const effectiveRole = permissionService.getEffectiveRole(user, formLog);

    return {
      canEdit,
      canApprove,
      canDispute,
      canCreateEval,
      isSubject: isSubjectFlag,
      isEvaluator: isEvaluatorFlag,
      isReviewer: isReviewerFlag,
      canViewScores,
      canSelfEval: canSelfEvalFlag,
      effectiveRole,
    };
  }, [user, formLog, formSettings, currentStep]);
}
