/**
 * evalStore.ts
 * Zustand evaluation store — caches active form logs and the current
 * evaluation scoring session.
 *
 * This store bridges React Query (server state) and the UI by holding:
 *  - The list of active form logs for the current user
 *  - The form log currently open for scoring
 *  - The rendered form state (built by evaluationRenderer engine)
 *  - A pending score queue for optimistic UI updates before API confirmation
 *
 * Usage:
 *   const { currentRenderedForm, updatePendingScore } = useEvalStore();
 */

import { create } from 'zustand';
import type { BubbleEvalFormLog } from '@/types';
import type { RenderedEvalForm } from '@/engines/evaluationRenderer';

// ─── Pending score entry ──────────────────────────────────────────────────────

/** A score that has been entered by the evaluator but not yet confirmed by the API */
interface PendingScore {
  score: number;
  notes?: string;
  /** Client-side timestamp of when this score was entered */
  enteredAt: number;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface EvalStore {
  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * All form logs that are currently in an active state for the current user.
   * Populated by the useActiveFormLogs hook.
   */
  activeFormLogs: BubbleEvalFormLog[];

  /**
   * The single form log the user currently has open.
   * Set when navigating to EvalDetail or EvalScoring screens.
   */
  currentFormLog: BubbleEvalFormLog | null;

  /**
   * The rendered, UI-ready form state built by the evaluationRenderer engine.
   * Null when no evaluation is open.
   */
  currentRenderedForm: RenderedEvalForm | null;

  /**
   * Optimistic score queue: maps attributeId → pending score + notes.
   * Entries are added immediately when an evaluator taps a score option,
   * then cleared once the API call confirms.
   */
  pendingScores: Record<string, PendingScore>;

  /**
   * Whether a score save operation is currently in-flight.
   * Used to show inline saving indicators on attribute rows.
   */
  isSavingScore: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Replaces the entire active form logs list.
   * Called by useActiveFormLogs after fetching from the API.
   */
  setActiveFormLogs: (logs: BubbleEvalFormLog[]) => void;

  /**
   * Sets the form log currently open for viewing or scoring.
   * Pass null to clear (e.g. on screen unmount).
   */
  setCurrentFormLog: (log: BubbleEvalFormLog | null) => void;

  /**
   * Sets the rendered form state.
   * Call this after buildRenderedForm() to drive the scoring UI.
   */
  setCurrentRenderedForm: (form: RenderedEvalForm | null) => void;

  /**
   * Records an optimistic score for a specific attribute.
   * Also applies the score to currentRenderedForm immediately via
   * mergeScoreUpdate so the UI reflects the change without waiting for the API.
   */
  updatePendingScore: (
    attributeId: string,
    categoryId: string,
    score: number,
    notes?: string,
  ) => void;

  /**
   * Removes a pending score for the given attributeId once the API confirms.
   */
  confirmPendingScore: (attributeId: string) => void;

  /**
   * Clears all pending scores (e.g. when navigating away from scoring screen).
   */
  clearPendingScores: () => void;

  /**
   * Sets the saving indicator flag.
   */
  setIsSavingScore: (saving: boolean) => void;

  /**
   * Updates an existing form log in the activeFormLogs list.
   * Called after a PATCH to keep the list in sync without a full refetch.
   */
  updateActiveFormLog: (updated: BubbleEvalFormLog) => void;

  /**
   * Removes a form log from the activeFormLogs list by ID.
   */
  removeActiveFormLog: (formLogId: string) => void;

  /**
   * Resets all evaluation state (called on logout).
   */
  clearEvalStore: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useEvalStore = create<EvalStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────

  activeFormLogs: [],
  currentFormLog: null,
  currentRenderedForm: null,
  pendingScores: {},
  isSavingScore: false,

  // ── setActiveFormLogs ─────────────────────────────────────────────────────

  setActiveFormLogs: (logs) => {
    set({ activeFormLogs: logs });
  },

  // ── setCurrentFormLog ─────────────────────────────────────────────────────

  setCurrentFormLog: (log) => {
    set({ currentFormLog: log });
  },

  // ── setCurrentRenderedForm ────────────────────────────────────────────────

  setCurrentRenderedForm: (form) => {
    set({ currentRenderedForm: form });
  },

  // ── updatePendingScore ────────────────────────────────────────────────────

  updatePendingScore: (attributeId, categoryId, score, notes) => {
    const { currentRenderedForm } = get();

    // Apply optimistic update to the rendered form immediately
    if (currentRenderedForm) {
      // Import inline to avoid circular dependency in store files.
      // The function is a pure utility and adds no runtime cost.
      const { mergeScoreUpdate } = require('@/engines/evaluationRenderer') as {
        mergeScoreUpdate: typeof import('@/engines/evaluationRenderer').mergeScoreUpdate;
      };

      const updatedForm = mergeScoreUpdate(
        currentRenderedForm,
        categoryId,
        attributeId,
        score,
        notes,
      );

      set({
        currentRenderedForm: updatedForm,
        pendingScores: {
          ...get().pendingScores,
          [attributeId]: {
            score,
            notes,
            enteredAt: Date.now(),
          },
        },
      });
    } else {
      set({
        pendingScores: {
          ...get().pendingScores,
          [attributeId]: {
            score,
            notes,
            enteredAt: Date.now(),
          },
        },
      });
    }
  },

  // ── confirmPendingScore ───────────────────────────────────────────────────

  confirmPendingScore: (attributeId) => {
    const { pendingScores } = get();
    const { [attributeId]: _removed, ...remaining } = pendingScores;
    set({ pendingScores: remaining });
  },

  // ── clearPendingScores ────────────────────────────────────────────────────

  clearPendingScores: () => {
    set({ pendingScores: {} });
  },

  // ── setIsSavingScore ──────────────────────────────────────────────────────

  setIsSavingScore: (saving) => {
    set({ isSavingScore: saving });
  },

  // ── updateActiveFormLog ───────────────────────────────────────────────────

  updateActiveFormLog: (updated) => {
    set((state) => ({
      activeFormLogs: state.activeFormLogs.map((log) =>
        log._id === updated._id ? updated : log,
      ),
      // Also update currentFormLog if it matches
      currentFormLog:
        state.currentFormLog?._id === updated._id
          ? updated
          : state.currentFormLog,
    }));
  },

  // ── removeActiveFormLog ───────────────────────────────────────────────────

  removeActiveFormLog: (formLogId) => {
    set((state) => ({
      activeFormLogs: state.activeFormLogs.filter(
        (log) => log._id !== formLogId,
      ),
      currentFormLog:
        state.currentFormLog?._id === formLogId ? null : state.currentFormLog,
    }));
  },

  // ── clearEvalStore ────────────────────────────────────────────────────────

  clearEvalStore: () => {
    set({
      activeFormLogs: [],
      currentFormLog: null,
      currentRenderedForm: null,
      pendingScores: {},
      isSavingScore: false,
    });
  },
}));

// ─── Computed selectors ───────────────────────────────────────────────────────

/**
 * Returns the count of active form logs that require action from the current user.
 * Used for the tab badge count on the Evaluations tab.
 */
export function selectNeedsActionCount(): number {
  const logs = useEvalStore.getState().activeFormLogs;
  return logs.filter((log) =>
    ['draft', 'in_progress', 'pending_review', 'disputed'].includes(log.Status),
  ).length;
}

/**
 * Returns true if there are any pending (unsaved) scores in the queue.
 */
export function selectHasPendingScores(): boolean {
  return Object.keys(useEvalStore.getState().pendingScores).length > 0;
}
