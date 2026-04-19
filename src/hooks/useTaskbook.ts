/**
 * useTaskbook.ts
 * React Query hooks for taskbook data.
 *
 * Composes raw Bubble data fetches with the taskbookEngine to produce
 * TaskbookState objects ready for rendering.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { get, post, patch } from '@/api/client';
import {
  BUBBLE_TYPES,
  buildConstraints,
  buildConstraintsFromArray,
  buildSortParams,
  dataUrl,
  dataUrlById,
} from '@/api/bubble';
import { normalizeBubbleList, normalizeBubbleSingle } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import {
  buildTaskbookState,
  type TaskbookState,
} from '@/engines/taskbookEngine';
import type {
  BubbleProgramRoster,
  BubbleProgramPhase,
  BubblePhaseRequirement,
  BubbleTaskbookLog,
  BubbleTask,
  BubbleAssessment,
} from '@/types';

// ─── Query key factory ────────────────────────────────────────────────────────

export const taskbookKeys = {
  all: ['taskbook'] as const,
  roster: (userId: string) => ['roster', userId] as const,
  subjectRosters: (evaluatorId: string) => ['subjectRosters', evaluatorId] as const,
  currentPhase: (rosterId: string) => ['currentPhase', rosterId] as const,
  requirements: (phaseId: string) => ['requirements', phaseId] as const,
  taskbookLogs: (rosterId: string, phaseId: string) =>
    ['taskbookLogs', rosterId, phaseId] as const,
  taskbookState: (rosterId: string) => ['taskbookState', rosterId] as const,
  tasks: (phaseId: string) => ['tasks', phaseId] as const,
  assessments: (phaseId: string) => ['assessments', phaseId] as const,
} as const;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchRosterForSubject(
  userId: string,
): Promise<BubbleProgramRoster | null> {
  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Subject', constraint_type: 'equals' as const, value: userId },
      { key: 'Active', constraint_type: 'equals' as const, value: true },
    ]),
    limit: 1,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_ROSTER), { params });
  const list = normalizeBubbleList<BubbleProgramRoster>(raw);
  return list.results[0] ?? null;
}

async function fetchRostersForEvaluator(
  evaluatorId: string,
): Promise<BubbleProgramRoster[]> {
  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Assigned Trainer', constraint_type: 'equals' as const, value: evaluatorId },
      { key: 'Active', constraint_type: 'equals' as const, value: true },
    ]),
    limit: 100,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PROGRAM_ROSTER), { params });
  return normalizeBubbleList<BubbleProgramRoster>(raw).results;
}

async function fetchRosterById(rosterId: string): Promise<BubbleProgramRoster> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.PROGRAM_ROSTER, rosterId));
  return normalizeBubbleSingle<BubbleProgramRoster>(raw);
}

async function fetchPhaseById(phaseId: string): Promise<BubbleProgramPhase> {
  const raw = await get<unknown>(dataUrlById(BUBBLE_TYPES.PROGRAM_PHASE, phaseId));
  return normalizeBubbleSingle<BubbleProgramPhase>(raw);
}

async function fetchRequirements(phaseId: string): Promise<BubblePhaseRequirement[]> {
  const params = {
    constraints: buildConstraints({ 'Program Phase': phaseId }),
    ...buildSortParams('Rank', true),
    limit: 100,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.PHASE_REQUIREMENT), { params });
  return normalizeBubbleList<BubblePhaseRequirement>(raw).results;
}

async function fetchTaskbookLogs(
  subjectId: string,
  phaseId: string,
): Promise<BubbleTaskbookLog[]> {
  const params = {
    constraints: buildConstraintsFromArray([
      { key: 'Intern User', constraint_type: 'equals' as const, value: subjectId },
      { key: 'Phase', constraint_type: 'equals' as const, value: phaseId },
    ]),
    limit: 500,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASKBOOK_LOG), { params });
  return normalizeBubbleList<BubbleTaskbookLog>(raw).results;
}

async function fetchTasksForPhase(phaseId: string): Promise<BubbleTask[]> {
  const params = {
    constraints: buildConstraints({ 'Program Phase': phaseId }),
    ...buildSortParams('Order', true),
    limit: 200,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.TASK), { params });
  return normalizeBubbleList<BubbleTask>(raw).results;
}

async function fetchAssessmentsForPhase(phaseId: string): Promise<BubbleAssessment[]> {
  const params = {
    constraints: buildConstraints({ 'Program Phase': phaseId }),
    limit: 100,
  };
  const raw = await get<unknown>(dataUrl(BUBBLE_TYPES.ASSESSMENT), { params });
  return normalizeBubbleList<BubbleAssessment>(raw).results;
}

// ─── Current user's roster ────────────────────────────────────────────────────

/**
 * Fetches the active program roster entry for the current user (subject role).
 */
export function useMyRoster(): UseQueryResult<BubbleProgramRoster | null, Error> {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: taskbookKeys.roster(user?._id ?? ''),
    queryFn: () => fetchRosterForSubject(user!._id),
    enabled: Boolean(user) && user?.['APEx Role'] === 'subject',
    staleTime: 60_000,
    retry: 2,
  });
}

// ─── Current phase for a roster ───────────────────────────────────────────────

/**
 * Fetches the BubbleProgramPhase the roster entry is currently in.
 */
export function useCurrentPhase(
  rosterId: string,
): UseQueryResult<BubbleProgramPhase | null, Error> {
  return useQuery({
    queryKey: taskbookKeys.currentPhase(rosterId),
    queryFn: async () => {
      const roster = await fetchRosterById(rosterId);
      if (!roster['Current Phase']) return null;
      return fetchPhaseById(roster['Current Phase']);
    },
    enabled: Boolean(rosterId),
    staleTime: 120_000,
    retry: 2,
  });
}

// ─── Full taskbook state ──────────────────────────────────────────────────────

/**
 * Fetches all data needed to render the taskbook for a roster entry and
 * runs it through the taskbookEngine to produce a TaskbookState.
 *
 * Makes parallel requests for requirements, logs, tasks, and assessments
 * to minimise total latency.
 */
export function useTaskbookState(
  rosterId: string,
): UseQueryResult<TaskbookState | null, Error> {
  return useQuery({
    queryKey: taskbookKeys.taskbookState(rosterId),
    queryFn: async (): Promise<TaskbookState | null> => {
      // First get the roster to find the current phase
      const roster = await fetchRosterById(rosterId);
      if (!roster['Current Phase']) return null;

      const phase = await fetchPhaseById(roster['Current Phase']);

      // Fetch everything needed in parallel.
      // taskbookLogs are filtered by subject user ID + phase (no roster field on the log).
      const [requirements, taskbookLogs, tasks, assessments] = await Promise.all([
        fetchRequirements(phase._id),
        fetchTaskbookLogs(roster.Subject, phase._id),
        fetchTasksForPhase(phase._id),
        fetchAssessmentsForPhase(phase._id),
      ]);

      return buildTaskbookState(
        phase,
        requirements,
        taskbookLogs,
        tasks,
        assessments,
      );
    },
    enabled: Boolean(rosterId),
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Subject rosters for evaluators ──────────────────────────────────────────

/**
 * Returns all active program rosters where the current user is the
 * assigned trainer.  For evaluators managing multiple subjects.
 */
export function useSubjectRosters(): UseQueryResult<BubbleProgramRoster[], Error> {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: taskbookKeys.subjectRosters(user?._id ?? ''),
    queryFn: () => fetchRostersForEvaluator(user!._id),
    enabled: Boolean(user) && (
      user?.['APEx Role'] === 'evaluator' || user?.['APEx Role'] === 'admin'
    ),
    staleTime: 120_000,
    retry: 2,
  });
}

// ─── Mark task complete mutation ──────────────────────────────────────────────

export interface MarkTaskCompleteVariables {
  rosterId: string;
  programId: string;
  phaseId: string;
  requirementId: string;
  taskRefId?: string;
  notes?: string;
  attemptNumber: number;
}

/**
 * Mutation that creates or updates a BubbleTaskbookLog to mark a task
 * as complete.  Invalidates the taskbook state query on success.
 */
export function useMarkTaskComplete(): UseMutationResult<
  BubbleTaskbookLog,
  Error,
  MarkTaskCompleteVariables
> {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      programId,
      phaseId,
      requirementId,
      taskRefId,
      notes,
      attemptNumber,
    }): Promise<BubbleTaskbookLog> => {
      if (!user) throw new Error('Not authenticated');

      const payload: Partial<BubbleTaskbookLog> = {
        'Intern User': user._id,
        Program: programId,
        Phase: phaseId,
        Requirement: requirementId,
        'Task Ref': taskRefId,
        'Attempt Number': attemptNumber,
        Success: true,
        'Completed By': user._id,
        'Completed At': new Date().toISOString(),
        Notes: notes,
        'Cosign Pending': false,
      };

      const createRaw = await post<{ id?: string }>(
        dataUrl(BUBBLE_TYPES.TASKBOOK_LOG),
        payload,
      );

      if (!createRaw.id) {
        throw new Error('Bubble did not return an ID for the new TaskbookLog');
      }

      const fetchedRaw = await get<unknown>(
        dataUrlById(BUBBLE_TYPES.TASKBOOK_LOG, createRaw.id),
      );
      return normalizeBubbleSingle<BubbleTaskbookLog>(fetchedRaw);
    },

    onSuccess: (_data, { rosterId }) => {
      void queryClient.invalidateQueries({
        queryKey: taskbookKeys.taskbookState(rosterId),
      });
    },
  });
}

// ─── Cosign task mutation ─────────────────────────────────────────────────────

export interface CosignTaskVariables {
  taskbookLogId: string;
  rosterId: string;
}

/**
 * Mutation that records a co-sign on an existing taskbook log entry.
 * Called by evaluators/reviewers to sign off on a completed task.
 */
export function useCosignTask(): UseMutationResult<
  BubbleTaskbookLog,
  Error,
  CosignTaskVariables
> {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ taskbookLogId }): Promise<BubbleTaskbookLog> => {
      if (!user) throw new Error('Not authenticated');

      await patch<unknown>(
        dataUrlById(BUBBLE_TYPES.TASKBOOK_LOG, taskbookLogId),
        {
          'Cosign Pending': false,
          'Cosigned By': user._id,
          'Cosigned At': new Date().toISOString(),
        },
      );

      const fetchedRaw = await get<unknown>(
        dataUrlById(BUBBLE_TYPES.TASKBOOK_LOG, taskbookLogId),
      );
      return normalizeBubbleSingle<BubbleTaskbookLog>(fetchedRaw);
    },

    onSuccess: (_data, { rosterId }) => {
      void queryClient.invalidateQueries({
        queryKey: taskbookKeys.taskbookState(rosterId),
      });
    },
  });
}
