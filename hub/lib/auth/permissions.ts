/**
 * Role-based permission system for APEx Hub.
 *
 * Roles (from Prisma UserRole / OrgMemberRole enums):
 *   OWNER   — full access, including billing and member management
 *   ADMIN   — all operational permissions; cannot change billing or owner
 *   MEMBER  — standard operator: chat, upload, run workflows
 *   VIEWER  — read-only access to agents and documents
 *
 * Usage:
 *   checkPermission('ADMIN', 'workflows:create')  // → true
 *   checkPermission('VIEWER', 'settings:manage')  // → false
 *
 *   // In an API Route Handler:
 *   const session = await auth();
 *   requirePermission(session?.user?.role, 'documents:upload');
 *   // throws PermissionDeniedError when the role lacks the permission
 */

// ─── Action catalogue ─────────────────────────────────────────────────────────

export type PermissionAction =
  | 'agents:chat'
  | 'agents:configure'
  | 'documents:upload'
  | 'documents:delete'
  | 'documents:read'
  | 'workflows:create'
  | 'workflows:run'
  | 'workflows:delete'
  | 'settings:manage'
  | 'members:manage'
  | 'billing:manage'
  | 'memories:read'
  | 'memories:write'
  | 'memories:delete'
  | 'integrations:manage'
  | 'audit:read';

// ─── Role → allowed actions ───────────────────────────────────────────────────

/**
 * Explicit allowlist per role.
 * More permissive roles include all actions of less permissive roles.
 */
export const PERMISSIONS: Record<string, PermissionAction[]> = {
  // ── VIEWER: read-only ──────────────────────────────────────────────────────
  VIEWER: [
    'agents:chat',
    'documents:read',
    'memories:read',
  ],

  // ── MEMBER: day-to-day operator ───────────────────────────────────────────
  MEMBER: [
    // Inherits VIEWER
    'agents:chat',
    'documents:read',
    'memories:read',
    // Extensions
    'documents:upload',
    'workflows:run',
    'memories:write',
  ],

  // ── ADMIN: configuration + management ────────────────────────────────────
  ADMIN: [
    // Inherits MEMBER
    'agents:chat',
    'documents:read',
    'memories:read',
    'documents:upload',
    'workflows:run',
    'memories:write',
    // Extensions
    'agents:configure',
    'documents:delete',
    'workflows:create',
    'workflows:delete',
    'settings:manage',
    'members:manage',
    'memories:delete',
    'integrations:manage',
    'audit:read',
  ],

  // ── OWNER: all permissions ─────────────────────────────────────────────────
  OWNER: [
    'agents:chat',
    'agents:configure',
    'documents:upload',
    'documents:delete',
    'documents:read',
    'workflows:create',
    'workflows:run',
    'workflows:delete',
    'settings:manage',
    'members:manage',
    'billing:manage',
    'memories:read',
    'memories:write',
    'memories:delete',
    'integrations:manage',
    'audit:read',
  ],
};

// ─── PermissionDeniedError ────────────────────────────────────────────────────

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  readonly action: PermissionAction;
  readonly role: string;

  constructor(role: string, action: PermissionAction) {
    super(
      `Permission denied: role "${role}" is not allowed to perform "${action}".`
    );
    this.name    = 'PermissionDeniedError';
    this.action  = action;
    this.role    = role;
  }
}

// ─── checkPermission ──────────────────────────────────────────────────────────

/**
 * Returns true when `role` is permitted to perform `action`.
 * Unknown roles are treated as VIEWER (most restrictive).
 *
 * @param role    UserRole or OrgMemberRole string (e.g. 'ADMIN').
 * @param action  PermissionAction to check.
 */
export function checkPermission(role: string, action: PermissionAction): boolean {
  const normalised = role?.toUpperCase() ?? 'VIEWER';
  const allowed    = PERMISSIONS[normalised] ?? PERMISSIONS['VIEWER'];
  return allowed.includes(action);
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Throws `PermissionDeniedError` (HTTP 403) when the role does not have
 * the required permission.  Safe to call inside Server Actions and API
 * Route Handlers — Next.js will surface it as a 403 response.
 *
 * @param role   Current user's role (from session).
 * @param action Action being attempted.
 *
 * @example
 *   const session = await auth();
 *   requirePermission(session?.user?.role ?? 'VIEWER', 'workflows:create');
 */
export function requirePermission(
  role: string | undefined | null,
  action: PermissionAction
): void {
  const r = role ?? 'VIEWER';
  if (!checkPermission(r, action)) {
    throw new PermissionDeniedError(r, action);
  }
}

// ─── getPermissionsForRole ────────────────────────────────────────────────────

/**
 * Returns all actions allowed for the given role.
 * Useful for building permission-aware UIs without calling checkPermission
 * for every action individually.
 */
export function getPermissionsForRole(role: string): PermissionAction[] {
  const normalised = role?.toUpperCase() ?? 'VIEWER';
  return [...(PERMISSIONS[normalised] ?? PERMISSIONS['VIEWER'])];
}

// ─── hasAnyPermission ─────────────────────────────────────────────────────────

/**
 * Returns true when the role has at least one of the supplied actions.
 * Useful for conditional UI rendering where multiple actions map to the
 * same UI element.
 */
export function hasAnyPermission(
  role: string,
  actions: PermissionAction[]
): boolean {
  return actions.some((a) => checkPermission(role, a));
}

// ─── hasAllPermissions ────────────────────────────────────────────────────────

/**
 * Returns true only when the role has every supplied action.
 */
export function hasAllPermissions(
  role: string,
  actions: PermissionAction[]
): boolean {
  return actions.every((a) => checkPermission(role, a));
}
