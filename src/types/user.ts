/**
 * user.ts
 * Types representing Bubble.io Users as they relate to APEx360.
 */

/** All roles a user may hold within the APEx evaluation system. */
export type APExRole = 'evaluator' | 'subject' | 'reviewer' | 'admin';

/**
 * Represents a Bubble.io User record as returned by the Data API.
 * Field names match Bubble's field naming convention (spaces preserved).
 */
export interface BubbleUser {
  /** Bubble auto-generated unique identifier */
  _id: string;
  /** Primary email address — used for authentication */
  email: string;
  'First Name'?: string;
  'Last Name'?: string;
  /** Whether the user has been granted access to APEx features */
  'APEx Access': boolean;
  /** Primary APEx role — controls default permissions and navigation */
  'APEx Role': APExRole;
  /** Additional roles — a user may serve multiple functions (e.g. evaluator + reviewer) */
  'APEx Roles'?: APExRole[];
  /** Agency/department personnel identifier (badge or employee number) */
  'Personnel ID'?: string;
  /** Bubble _id of this user's direct supervisor */
  'Supervisor ID'?: string;
  /** Linked Canvas LMS user ID for assignment/quiz integration */
  'Canvas User ID'?: string;
  /** Organization or agency name */
  Organization?: string;
  /** ISO 8601 creation timestamp */
  created_date?: string;
  /** ISO 8601 last-modified timestamp */
  modified_date?: string;
}

/**
 * Derived display name helper — returns full name or email fallback.
 */
export function getUserDisplayName(user: BubbleUser): string {
  const first = user['First Name'] ?? '';
  const last = user['Last Name'] ?? '';
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : user.email;
}

/**
 * Returns initials for avatar display (max 2 characters).
 */
export function getUserInitials(user: BubbleUser): string {
  const first = user['First Name']?.[0] ?? '';
  const last = user['Last Name']?.[0] ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return user.email[0]?.toUpperCase() ?? '?';
}

// ---------------------------------------------------------------------------
// Auth state (managed by Zustand store)
// ---------------------------------------------------------------------------

export interface AuthState {
  user: BubbleUser | null;
  /** Bubble API token stored securely via expo-secure-store */
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  token: string;
  user_id: string;
  expires?: string;
}
