/**
 * auth.ts
 * Authentication API endpoints wrapping Bubble's user authentication.
 *
 * Bubble's auth endpoint: POST /user/login → { token, user_id }
 * Current user: GET /obj/user/me
 */

import * as SecureStore from 'expo-secure-store';
import { get, post } from '../client';
import { BUBBLE_TYPES, dataUrl } from '../bubble';
import type { BubbleUser } from '../../types/user';
import type { AuthTokenResponse } from '../../types/user';

const TOKEN_KEY = 'apex_auth_token';

// ─── Response Shapes ─────────────────────────────────────────────────────────

interface BubbleLoginResponse {
  token: string;
  user_id: string;
  expires?: string;
}

interface BubbleUserMeResponse {
  response: BubbleUser;
}

// ─── Auth Endpoints ───────────────────────────────────────────────────────────

/**
 * Authenticates a user with Bubble via email/password.
 *
 * On success, the token is persisted to SecureStore so that the Axios
 * request interceptor can attach it to subsequent requests automatically.
 *
 * Returns the raw token and the resolved BubbleUser so callers can
 * hydrate their auth store in a single call.
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ token: string; user: BubbleUser }> {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Bubble login endpoint returns the token directly (not under a response key)
  const loginData = await post<BubbleLoginResponse>('/user/login', {
    email: email.trim().toLowerCase(),
    password,
  });

  const { token } = loginData;

  // Persist to SecureStore immediately so subsequent calls are authenticated
  await SecureStore.setItemAsync(TOKEN_KEY, token);

  // Fetch the full user object now that we're authenticated
  const user = await getCurrentUser();

  return { token, user };
}

/**
 * Fetches the currently authenticated user's Bubble record.
 * Relies on the Bearer token being present in the request interceptor.
 */
export async function getCurrentUser(): Promise<BubbleUser> {
  // Bubble exposes /obj/user/me for the authenticated user
  const response = await get<BubbleUserMeResponse>(
    `${dataUrl(BUBBLE_TYPES.USER)}/me`,
  );
  return response.response;
}

/**
 * Clears the stored authentication token, effectively logging the user out
 * from the mobile app's perspective. The Bubble session on the server
 * persists until it naturally expires.
 */
export async function logout(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // If SecureStore fails, we still want to clear local state
  }
}

/**
 * Retrieves the stored auth token without making a network request.
 * Returns null if no token is stored.
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Checks whether a stored token exists. Does not validate the token
 * against the server — use getCurrentUser() for server-side validation.
 */
export async function hasStoredToken(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null && token.length > 0;
}
