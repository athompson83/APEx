/**
 * authService.ts
 * Authentication service — wraps auth API calls with token lifecycle management.
 *
 * This service is the single source of truth for the authentication state
 * during an app session. It persists the token to SecureStore and validates
 * it on app startup so users stay logged in across app restarts.
 */

import * as SecureStore from 'expo-secure-store';
import {
  loginWithEmail as apiLogin,
  getCurrentUser,
  logout as apiLogout,
  getStoredToken,
  hasStoredToken,
} from '../api/endpoints/auth';
import type { BubbleUser } from '../types/user';

const TOKEN_KEY = 'apex_auth_token';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthInitResult {
  isAuthenticated: boolean;
  user: BubbleUser | null;
  token: string | null;
}

export interface LoginResult {
  user: BubbleUser;
  token: string;
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Checks for a stored auth token and validates it against Bubble on app start.
 *
 * Call this once at app initialization (e.g. in App.tsx or a root layout).
 * If a valid token exists and the server recognizes it, returns the full user.
 * If the token is expired or invalid, it is cleared and unauthenticated state
 * is returned.
 *
 * This allows users to remain logged in across app restarts without re-entering
 * credentials, while ensuring stale/revoked tokens are cleaned up.
 */
export async function initAuth(): Promise<AuthInitResult> {
  const hasToken = await hasStoredToken();

  if (!hasToken) {
    return { isAuthenticated: false, user: null, token: null };
  }

  const token = await getStoredToken();

  try {
    // Validate token by fetching the current user — if this succeeds, we're in
    const user = await getCurrentUser();
    return { isAuthenticated: true, user, token };
  } catch {
    // Token is invalid or expired — clear it
    await clearStoredToken();
    return { isAuthenticated: false, user: null, token: null };
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticates a user with Bubble using email/password credentials.
 *
 * On success:
 *  1. The Bubble auth token is stored in SecureStore.
 *  2. The full BubbleUser record is fetched and returned.
 *
 * Throws an APIError if credentials are invalid (401) or the server is
 * unreachable (network error).
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required');
  }
  if (!password || password.length < 1) {
    throw new Error('Password is required');
  }

  const { token, user } = await apiLogin(email, password);

  // Token is already persisted by apiLogin, but we re-set here to be
  // explicit about what this service layer guarantees.
  await SecureStore.setItemAsync(TOKEN_KEY, token);

  return { token, user };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Logs out the current user by clearing the stored auth token.
 *
 * Does not call a server-side logout endpoint (Bubble tokens expire naturally).
 * After this call, all subsequent API requests will fail with 401 until
 * the user logs in again.
 */
export async function logout(): Promise<void> {
  await apiLogout();
  await clearStoredToken();
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the currently stored auth token, or null if none exists.
 * Safe to call at any time — does not make a network request.
 */
export { getStoredToken };

/**
 * Clears the stored auth token from SecureStore.
 * Errors are swallowed to ensure cleanup always completes.
 */
async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // SecureStore failure should not prevent logout from completing
  }
}

/**
 * Refreshes the current user's profile from Bubble.
 * Useful after profile updates that may have changed the user record.
 * Requires a valid token to be stored.
 */
export async function refreshCurrentUser(): Promise<BubbleUser | null> {
  const hasToken = await hasStoredToken();
  if (!hasToken) return null;

  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
