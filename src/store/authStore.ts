/**
 * authStore.ts
 * Zustand authentication store.
 *
 * Manages the authenticated user, token, and auth loading state.
 * The token is persisted to and restored from expo-secure-store so sessions
 * survive app restarts.
 *
 * Usage:
 *   const { user, isAuthenticated } = useAuthStore();
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { BubbleUser } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_SECURE_KEY = 'apex_auth_token';

// ─── Store interface ──────────────────────────────────────────────────────────

interface AuthStore {
  // ── State ──────────────────────────────────────────────────────────────────

  /** The authenticated user record from Bubble, or null if not signed in */
  user: BubbleUser | null;

  /**
   * The Bubble API bearer token, or null if not authenticated.
   * This value mirrors what is persisted in SecureStore.
   */
  token: string | null;

  /** True when a valid token + user is present */
  isAuthenticated: boolean;

  /**
   * True while the store is performing async operations (init auth check,
   * login, logout).  Components should show a loading state during this.
   */
  isLoading: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Sets the current user.  Pass null to clear the user without a full sign-out.
   * isAuthenticated is derived from both user and token being non-null.
   */
  setUser: (user: BubbleUser | null) => void;

  /**
   * Persists the bearer token to SecureStore and updates in-memory state.
   * Pass null to clear the token (triggers isAuthenticated = false).
   */
  setToken: (token: string | null) => Promise<void>;

  /**
   * Clears all auth state and removes the token from SecureStore.
   * Call this on explicit logout.
   */
  clearAuth: () => Promise<void>;

  /**
   * Sets the loading flag for async auth operations.
   */
  setLoading: (loading: boolean) => void;

  /**
   * Restores auth state from SecureStore on app launch.
   * Sets isLoading to true during the check and false when done.
   * Returns the persisted token, or null if none is found.
   */
  initAuth: () => Promise<string | null>;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────

  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start as loading until initAuth completes

  // ── setUser ────────────────────────────────────────────────────────────────

  setUser: (user) => {
    const { token } = get();
    set({
      user,
      isAuthenticated: user !== null && token !== null,
    });
  },

  // ── setToken ───────────────────────────────────────────────────────────────

  setToken: async (token) => {
    try {
      if (token) {
        await SecureStore.setItemAsync(TOKEN_SECURE_KEY, token);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_SECURE_KEY);
      }
    } catch (error) {
      // SecureStore failure should not block auth state update (e.g. simulator)
      if (__DEV__) {
        console.warn('[AuthStore] SecureStore setToken error:', error);
      }
    }

    const { user } = get();
    set({
      token,
      isAuthenticated: token !== null && user !== null,
    });
  },

  // ── clearAuth ─────────────────────────────────────────────────────────────

  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_SECURE_KEY);
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthStore] SecureStore clearAuth error:', error);
      }
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  // ── setLoading ────────────────────────────────────────────────────────────

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // ── initAuth ──────────────────────────────────────────────────────────────

  initAuth: async () => {
    set({ isLoading: true });

    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_SECURE_KEY);

      if (storedToken && storedToken.length > 0) {
        // Token found — update in-memory state.
        // The caller (root navigator / authService) is responsible for
        // validating the token against Bubble and fetching the user.
        set({ token: storedToken });
        return storedToken;
      }

      // No stored token
      set({ token: null, isAuthenticated: false });
      return null;
    } catch (error) {
      if (__DEV__) {
        console.warn('[AuthStore] SecureStore initAuth error:', error);
      }
      set({ token: null, isAuthenticated: false });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
}));

// ─── Convenience selectors ────────────────────────────────────────────────────

/** Returns the current user's Bubble _id, or null if not authenticated. */
export function selectUserId(): string | null {
  return useAuthStore.getState().user?._id ?? null;
}

/** Returns the current user's APEx role, or null if not authenticated. */
export function selectUserRole() {
  return useAuthStore.getState().user?.['APEx Role'] ?? null;
}
