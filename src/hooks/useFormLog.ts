/**
 * useFormLog.ts
 * React Query hooks for evaluation form log data.
 *
 * Provides read and mutation hooks for BubbleEvalFormLog records.
 * Cache keys are defined as constants so they can be imported for targeted
 * invalidation from other hooks (e.g. useWorkflow).
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryResult,
  type UseMutationResult,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';
import { useEvalStore } from '@/store/evalStore';
import {
  getFormLog,
  getActiveFormLogs,
  getCompletedFormLogs,
  getFormLogsNeedingMyAction,
  createFormLog,
  updateFormLog,
} from '@/api/endpoints/formLogs';
import type { BubbleEvalFormLog } from '@/types';

// ─── Query key factory ────────────────────────────────────────────────────────

export const formLogKeys = {
  all: ['formLogs'] as const,
  lists: () => [...formLogKeys.all, 'list'] as const,
  active: (userId: string) => [...formLogKeys.lists(), 'active', userId] as const,
  needsAction: (userId: string) => [...formLogKeys.lists(), 'needsAction', userId] as const,
  completed: (userId: string) => [...formLogKeys.lists(), 'completed', userId] as const,
  detail: (formLogId: string) => [...formLogKeys.all, 'detail', formLogId] as const,
} as const;

// ─── Single form log ──────────────────────────────────────────────────────────

/**
 * Fetches and caches a single BubbleEvalFormLog by ID.
 * Stale after 30 s; refetches on window focus.
 */
export function useFormLog(
  formLogId: string,
): UseQueryResult<BubbleEvalFormLog, Error> {
  return useQuery({
    queryKey: formLogKeys.detail(formLogId),
    queryFn: () => getFormLog(formLogId),
    enabled: Boolean(formLogId),
    staleTime: 30_000,
    retry: 2,
  });
}

// ─── Active form logs ─────────────────────────────────────────────────────────

/**
 * Fetches all active evaluations for the current user and syncs them into
 * the eval store so the tab badge count stays current.
 */
export function useActiveFormLogs(): UseQueryResult<BubbleEvalFormLog[], Error> {
  const user = useAuthStore((state) => state.user);
  const setActiveFormLogs = useEvalStore((state) => state.setActiveFormLogs);

  return useQuery({
    queryKey: formLogKeys.active(user?._id ?? ''),
    queryFn: async () => {
      if (!user) return [];
      const logs = await getActiveFormLogs(user._id, user['APEx Role']);
      // Sync to eval store for badge count
      setActiveFormLogs(logs);
      return logs;
    },
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchInterval: 90_000, // Background polling every 90 s
    retry: 2,
  });
}

// ─── Needs action ─────────────────────────────────────────────────────────────

/**
 * Returns form logs that specifically require an action from the current user.
 * Used for the dashboard "Action Required" section.
 */
export function useFormLogsNeedingAction(): UseQueryResult<BubbleEvalFormLog[], Error> {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: formLogKeys.needsAction(user?._id ?? ''),
    queryFn: async () => {
      if (!user) return [];
      return getFormLogsNeedingMyAction(user._id, user['APEx Role']);
    },
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}

// ─── Completed form logs (paginated) ─────────────────────────────────────────

interface CompletedFormLogsPage {
  logs: BubbleEvalFormLog[];
  remaining: number;
  nextCursor?: string;
}

/**
 * Returns paginated completed evaluations using React Query's infinite query.
 * Each page corresponds to one Bubble cursor.
 */
export function useCompletedFormLogs(): UseInfiniteQueryResult<
  InfiniteData<CompletedFormLogsPage>,
  Error
> {
  const user = useAuthStore((state) => state.user);

  return useInfiniteQuery({
    queryKey: formLogKeys.completed(user?._id ?? ''),
    queryFn: async ({ pageParam }) => {
      if (!user) return { logs: [], remaining: 0 };
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      const { logs, remaining } = await getCompletedFormLogs(
        user._id,
        user['APEx Role'],
        cursor,
      );
      return {
        logs,
        remaining,
        nextCursor: remaining > 0 ? String((parseInt(cursor ?? '0', 10)) + logs.length) : undefined,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CompletedFormLogsPage) => lastPage.nextCursor,
    enabled: Boolean(user),
    staleTime: 120_000,
    retry: 2,
  });
}

// ─── Create form log mutation ─────────────────────────────────────────────────

export interface CreateFormLogVariables {
  data: Partial<BubbleEvalFormLog>;
}

/**
 * Mutation that creates a new BubbleEvalFormLog in Bubble.
 * On success, invalidates the active and needs-action lists.
 */
export function useCreateFormLog(): UseMutationResult<
  BubbleEvalFormLog,
  Error,
  CreateFormLogVariables
> {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ data }) => createFormLog(data),
    onSuccess: (newLog) => {
      const userId = user?._id ?? '';

      // Add the new log to the detail cache immediately
      queryClient.setQueryData(formLogKeys.detail(newLog._id), newLog);

      // Invalidate list queries so they refetch
      void queryClient.invalidateQueries({ queryKey: formLogKeys.active(userId) });
      void queryClient.invalidateQueries({ queryKey: formLogKeys.needsAction(userId) });
    },
  });
}

// ─── Update form log mutation ─────────────────────────────────────────────────

export interface UpdateFormLogVariables {
  formLogId: string;
  data: Partial<BubbleEvalFormLog>;
}

/**
 * Mutation that PATCHes an existing BubbleEvalFormLog.
 * Applies an optimistic update to the detail cache; rolls back on error.
 */
export function useUpdateFormLog(): UseMutationResult<
  BubbleEvalFormLog,
  Error,
  UpdateFormLogVariables
> {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateActiveFormLog = useEvalStore((state) => state.updateActiveFormLog);

  return useMutation({
    mutationFn: ({ formLogId, data }) => updateFormLog(formLogId, data),

    onMutate: async ({ formLogId, data }) => {
      // Cancel in-flight queries for this log
      await queryClient.cancelQueries({ queryKey: formLogKeys.detail(formLogId) });

      // Snapshot current value for rollback
      const previousLog = queryClient.getQueryData<BubbleEvalFormLog>(
        formLogKeys.detail(formLogId),
      );

      // Optimistic update
      if (previousLog) {
        queryClient.setQueryData(formLogKeys.detail(formLogId), {
          ...previousLog,
          ...data,
        });
      }

      return { previousLog };
    },

    onError: (_error, { formLogId }, context) => {
      // Roll back on failure
      if (context?.previousLog) {
        queryClient.setQueryData(
          formLogKeys.detail(formLogId),
          context.previousLog,
        );
      }
    },

    onSuccess: (updatedLog) => {
      const userId = user?._id ?? '';

      // Update detail cache with confirmed server response
      queryClient.setQueryData(formLogKeys.detail(updatedLog._id), updatedLog);

      // Keep eval store in sync
      updateActiveFormLog(updatedLog);

      // Invalidate list queries
      void queryClient.invalidateQueries({ queryKey: formLogKeys.active(userId) });
      void queryClient.invalidateQueries({ queryKey: formLogKeys.needsAction(userId) });
    },
  });
}
