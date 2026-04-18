/**
 * useWorkflow.ts
 * React Query hooks for form workflow data and actions.
 *
 * Bridges the Bubble workflow API with local permission checks so UI
 * components can declaratively render the available actions for the
 * current user without knowledge of the underlying step machine.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { get, post } from '@/api/client';
import { BUBBLE_TYPES, buildConstraints, dataUrl, dataUrlById } from '@/api/bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import * as permissionService from '@/services/permissionService';
import { formLogKeys } from './useFormLog';
import type {
  BubbleFormWorkflow,
  BubbleFormWorkflowStep,
  BubbleEvalWorkflowLog,
  BubbleEvalFormLog,
  WorkflowAction,
} from '@/types';

// ─── Query key factory ────────────────────────────────────────────────────────

export const workflowKeys = {
  all: ['workflows'] as const,
  steps: (workflowId: string) => ['workflowSteps', workflowId] as const,
  currentStep: (formLogId: string) => ['currentStep', formLogId] as const,
  workflowLog: (formLogId: string) => ['workflowLog', formLogId] as const,
  actions: (formLogId: string) => ['workflowActions', formLogId] as const,
} as const;

// ─── Available workflow action descriptor ─────────────────────────────────────

export interface AvailableAction {
  action: WorkflowAction;
  /** Display label from the workflow step, or a sensible default */
  label: string;
  /** Whether this action is destructive / irreversible */
  isDestructive: boolean;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchWorkflowSteps(
  workflowId: string,
): Promise<BubbleFormWorkflowStep[]> {
  const params = {
    constraints: buildConstraints({ 'Form Workflow': workflowId }),
    sort_field: 'Rank',
    descending: 'false',
    limit: 50,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.WORKFLOW_STEP), { params });
  return normalizeBubbleList<BubbleFormWorkflowStep>(raw).results;
}

async function fetchWorkflowLog(
  formLogId: string,
): Promise<BubbleEvalWorkflowLog | null> {
  const params = {
    constraints: buildConstraints({ 'Eval Log': formLogId }),
    limit: 1,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.WORKFLOW_LOG), { params });
  const list = normalizeBubbleList<BubbleEvalWorkflowLog>(raw);
  return list.results[0] ?? null;
}

async function fetchCurrentStep(
  stepId: string,
): Promise<BubbleFormWorkflowStep | null> {
  if (!stepId) return null;
  try {
    const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.WORKFLOW_STEP, stepId));
    return normalizeBubbleSingle<BubbleFormWorkflowStep>(raw);
  } catch {
    return null;
  }
}

async function fetchFormLog(formLogId: string): Promise<BubbleEvalFormLog | null> {
  try {
    const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.EVAL_FORM_LOG, formLogId));
    return normalizeBubbleSingle<BubbleEvalFormLog>(raw);
  } catch {
    return null;
  }
}

// ─── Workflow steps ───────────────────────────────────────────────────────────

/**
 * Fetches all steps for a given workflow template, sorted by Rank.
 */
export function useWorkflowSteps(
  workflowId: string,
): UseQueryResult<BubbleFormWorkflowStep[], Error> {
  return useQuery({
    queryKey: workflowKeys.steps(workflowId),
    queryFn: () => fetchWorkflowSteps(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 300_000, // Workflow templates rarely change
    retry: 2,
  });
}

// ─── Current step ─────────────────────────────────────────────────────────────

/**
 * Resolves the current workflow step for a form log.
 * Fetches the workflow log, then resolves the Current Step reference.
 */
export function useCurrentStep(
  formLogId: string,
): UseQueryResult<BubbleFormWorkflowStep | null, Error> {
  return useQuery({
    queryKey: workflowKeys.currentStep(formLogId),
    queryFn: async () => {
      const workflowLog = await fetchWorkflowLog(formLogId);
      if (!workflowLog?.['Current Step']) return null;
      return fetchCurrentStep(workflowLog['Current Step']);
    },
    enabled: Boolean(formLogId),
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Workflow log ─────────────────────────────────────────────────────────────

/**
 * Fetches the BubbleEvalWorkflowLog associated with a form log.
 */
export function useWorkflowLog(
  formLogId: string,
): UseQueryResult<BubbleEvalWorkflowLog | null, Error> {
  return useQuery({
    queryKey: workflowKeys.workflowLog(formLogId),
    queryFn: () => fetchWorkflowLog(formLogId),
    enabled: Boolean(formLogId),
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Available actions ────────────────────────────────────────────────────────

/**
 * Derives the list of workflow actions available to the current user
 * for the given form log.
 *
 * Logic:
 *  1. Fetch the current workflow step.
 *  2. Fetch the current form log for status + assignee context.
 *  3. Check permission for each action using permissionService.
 *  4. Return only the actions the user may take.
 */
export function useWorkflowActions(
  formLogId: string,
): UseQueryResult<AvailableAction[], Error> {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: workflowKeys.actions(formLogId),
    queryFn: async (): Promise<AvailableAction[]> => {
      if (!user) return [];

      // Fetch both in parallel
      const [workflowLog, formLog] = await Promise.all([
        fetchWorkflowLog(formLogId),
        fetchFormLog(formLogId),
      ]);

      if (!workflowLog || !formLog) return [];

      // Workflow is already complete — no actions available
      if (workflowLog.Complete) return [];

      const currentStepId = workflowLog['Current Step'];
      if (!currentStepId) return [];

      const currentStep = await fetchCurrentStep(currentStepId);
      if (!currentStep) return [];

      const actions: AvailableAction[] = [];

      // Evaluator submitting a draft/in-progress eval
      if (
        formLog.Status === 'in_progress' ||
        formLog.Status === 'draft'
      ) {
        if (
          formLog.Evaluator === user._id ||
          user['APEx Role'] === 'admin'
        ) {
          actions.push({
            action: 'submit',
            label: 'Submit for Review',
            isDestructive: false,
          });
        }
      }

      // Approval action — check against step permissions
      if (
        (formLog.Status === 'pending_review' || formLog.Status === 'disputed') &&
        permissionService.canApprove(user, currentStep, formLog)
      ) {
        actions.push({
          action: 'approve',
          label: currentStep['Final Step'] ? 'Approve & Complete' : 'Approve',
          isDestructive: false,
        });

        // Return action (back to evaluator for corrections)
        if (!currentStep['Final Step']) {
          actions.push({
            action: 'return',
            label: 'Return to Evaluator',
            isDestructive: false,
          });
        }
      }

      // Dispute action — subject may dispute an approved eval
      if (
        currentStep['Dispute Allowed'] &&
        formLog.Subject === user._id &&
        (formLog.Status === 'approved' || formLog.Status === 'pending_review')
      ) {
        actions.push({
          action: 'dispute',
          label: 'Dispute Evaluation',
          isDestructive: true,
        });
      }

      return actions;
    },
    enabled: Boolean(formLogId) && Boolean(user),
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Submit workflow action mutation ──────────────────────────────────────────

export interface SubmitWorkflowActionVariables {
  formLogId: string;
  action: WorkflowAction;
  /** Optional comment / notes accompanying the action */
  comment?: string;
}

/**
 * Mutation that submits a workflow action for a form log.
 * Calls a Bubble backend workflow then invalidates related queries.
 */
export function useSubmitWorkflowAction(): UseMutationResult<
  void,
  Error,
  SubmitWorkflowActionVariables
> {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ formLogId, action, comment }) => {
      // Call the Bubble workflow API endpoint for this action
      await post<unknown>(`/wf/eval-workflow-action`, {
        eval_log_id: formLogId,
        action,
        comment: comment ?? '',
        actor_id: user?._id ?? '',
      });
    },

    onSuccess: (_data, { formLogId }) => {
      const userId = user?._id ?? '';

      // Invalidate all related queries so the UI reflects the new state
      void queryClient.invalidateQueries({
        queryKey: formLogKeys.detail(formLogId),
      });
      void queryClient.invalidateQueries({
        queryKey: workflowKeys.currentStep(formLogId),
      });
      void queryClient.invalidateQueries({
        queryKey: workflowKeys.workflowLog(formLogId),
      });
      void queryClient.invalidateQueries({
        queryKey: workflowKeys.actions(formLogId),
      });
      void queryClient.invalidateQueries({
        queryKey: formLogKeys.active(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: formLogKeys.needsAction(userId),
      });
    },
  });
}
