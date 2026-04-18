/**
 * uiStore.ts
 * Zustand UI store — network status, global toast notifications, and
 * lightweight app-level UI state.
 *
 * Usage:
 *   const { addToast, isOnline } = useUIStore();
 *   addToast('Evaluation saved', 'success');
 */

import { create } from 'zustand';

// ─── Toast type ───────────────────────────────────────────────────────────────

export interface Toast {
  /** Unique identifier — used to dismiss a specific toast */
  id: string;
  /** The message displayed to the user */
  message: string;
  /** Visual variant that controls colour and icon */
  type: 'success' | 'error' | 'warning' | 'info';
  /**
   * How long (ms) to show the toast before auto-dismissing.
   * Defaults to 3500ms.  Pass 0 to disable auto-dismiss.
   */
  duration?: number;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface UIStore {
  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Whether the device currently has an active network connection.
   * Updated by a NetInfo listener registered in the root component.
   */
  isOnline: boolean;

  /**
   * Queue of active toast notifications to be rendered by the global
   * ToastContainer component.
   */
  toasts: Toast[];

  /**
   * Whether the global full-screen loading overlay is visible.
   * Use sparingly — prefer skeleton screens and inline loaders.
   */
  isGlobalLoading: boolean;

  /**
   * Label shown beneath the global loading spinner.
   */
  globalLoadingLabel: string;

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Updates the online/offline status */
  setOnline: (online: boolean) => void;

  /**
   * Adds a toast to the notification queue.
   * Generates a unique ID automatically.
   *
   * @param message  Text to display
   * @param type     Visual variant
   * @param duration Auto-dismiss delay in ms (default 3500; pass 0 to disable)
   */
  addToast: (
    message: string,
    type: Toast['type'],
    duration?: number,
  ) => void;

  /**
   * Removes a toast from the queue by its ID.
   * Called by the toast component after the dismiss animation completes.
   */
  removeToast: (id: string) => void;

  /** Clears all toasts immediately (e.g. on screen transition) */
  clearToasts: () => void;

  /**
   * Shows the full-screen loading overlay.
   * @param label Optional descriptive label shown to the user
   */
  showGlobalLoading: (label?: string) => void;

  /** Hides the full-screen loading overlay */
  hideGlobalLoading: () => void;
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let toastCounter = 0;
function generateToastId(): string {
  toastCounter += 1;
  return `toast_${Date.now()}_${toastCounter}`;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useUIStore = create<UIStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────

  isOnline: true,
  toasts: [],
  isGlobalLoading: false,
  globalLoadingLabel: '',

  // ── setOnline ─────────────────────────────────────────────────────────────

  setOnline: (online) => {
    const wasOnline = get().isOnline;

    set({ isOnline: online });

    // Automatically show an informational toast when connectivity changes
    if (!online && wasOnline) {
      get().addToast(
        'You are offline. Changes will be saved when reconnected.',
        'warning',
        5000,
      );
    } else if (online && !wasOnline) {
      get().addToast('Back online', 'success', 2500);
    }
  },

  // ── addToast ──────────────────────────────────────────────────────────────

  addToast: (message, type, duration = 3500) => {
    const id = generateToastId();
    const newToast: Toast = { id, message, type, duration };

    set((state) => ({
      // Cap the queue at 4 visible toasts to avoid overwhelming the UI
      toasts: [...state.toasts.slice(-3), newToast],
    }));
  },

  // ── removeToast ───────────────────────────────────────────────────────────

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // ── clearToasts ───────────────────────────────────────────────────────────

  clearToasts: () => {
    set({ toasts: [] });
  },

  // ── showGlobalLoading ─────────────────────────────────────────────────────

  showGlobalLoading: (label = 'Loading…') => {
    set({ isGlobalLoading: true, globalLoadingLabel: label });
  },

  // ── hideGlobalLoading ─────────────────────────────────────────────────────

  hideGlobalLoading: () => {
    set({ isGlobalLoading: false, globalLoadingLabel: '' });
  },
}));
