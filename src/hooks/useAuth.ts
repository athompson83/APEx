/**
 * useAuth.ts
 * Authentication hook — provides login/logout actions with error state.
 *
 * Wraps authService calls and syncs results into the Zustand authStore.
 * All components that need auth state or actions should use this hook
 * rather than accessing the store or service directly.
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useEvalStore } from '@/store/evalStore';
import * as authService from '@/services/authService';
import type { BubbleUser } from '@/types';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseAuthReturn {
  /** The currently authenticated user, or null */
  user: BubbleUser | null;
  /** Whether the user has a valid authenticated session */
  isAuthenticated: boolean;
  /** True while login/logout or auth initialisation is in progress */
  isLoading: boolean;
  /**
   * Error message from the most recent failed login attempt.
   * Cleared on the next login attempt.
   */
  loginError: string | null;
  /** Whether a login request is currently in-flight */
  isLoggingIn: boolean;
  /**
   * Authenticates the user with Bubble.
   * Resolves with the user on success; sets loginError on failure.
   *
   * @returns The authenticated BubbleUser, or null if login failed.
   */
  login: (email: string, password: string) => Promise<BubbleUser | null>;
  /**
   * Signs the current user out and clears all local state.
   */
  logout: () => Promise<void>;
  /**
   * Clears the login error (e.g. when the user starts typing again).
   */
  clearLoginError: () => void;
}

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const { user, token, isAuthenticated, isLoading, setUser, setToken, clearAuth } =
    useAuthStore();
  const clearEvalStore = useEvalStore((state) => state.clearEvalStore);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<BubbleUser | null> => {
      setLoginError(null);
      setIsLoggingIn(true);

      try {
        const { user: loggedInUser, token: authToken } = await authService.login(
          email,
          password,
        );

        // Persist token (SecureStore) + hydrate store
        await setToken(authToken);
        setUser(loggedInUser);

        return loggedInUser;
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        setLoginError(message);
        return null;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [setToken, setUser],
  );

  // ── logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch {
      // Logout should always succeed client-side even if the API call fails
    } finally {
      await clearAuth();
      clearEvalStore();
    }
  }, [clearAuth, clearEvalStore]);

  // ── clearLoginError ───────────────────────────────────────────────────────

  const clearLoginError = useCallback(() => {
    setLoginError(null);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    loginError,
    isLoggingIn,
    login,
    logout,
    clearLoginError,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Bubble returns 401 with a message about invalid credentials
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid')) {
      return 'Invalid email or password. Please try again.';
    }

    // Network / timeout errors
    if (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnaborted')
    ) {
      return 'Unable to connect. Please check your internet connection.';
    }

    // Return the raw message for other errors in dev; generic in prod
    if (__DEV__) {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}
