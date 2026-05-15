/**
 * API Helpers for APEx Hub
 *
 * Centralised utilities used across all route handlers:
 *   - getAuthSession()          — enforces authentication
 *   - getUserOrg()              — resolves primary org for a user
 *   - validateRequest()         — Zod schema validation with typed output
 *   - apiError()                — uniform error response
 *   - apiSuccess()              — uniform success response
 *   - requireOrgMembership()    — checks user belongs to an org
 *   - paginationParams()        — parses page/limit query params
 */

import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth/config';
import db from '@/lib/db';
import type { Session } from 'next-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthenticatedSession extends Session {
  user: Session['user'] & { id: string };
}

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Returns the current session. Throws a 401 NextResponse if not authenticated.
 * Use inside route handlers:
 *
 *   const session = await getAuthSession();
 */
export async function getAuthSession(): Promise<AuthenticatedSession> {
  const session = await auth();

  if (!session?.user) {
    throw apiError('Unauthorized', 401);
  }

  if (!(session.user as { id?: string }).id) {
    throw apiError('Session missing user id', 401);
  }

  return session as AuthenticatedSession;
}

// ---------------------------------------------------------------------------
// Organisation resolution
// ---------------------------------------------------------------------------

/**
 * Returns the user's primary organisation membership (first one by join date).
 * Throws 404 if the user belongs to no organisation.
 */
export async function getUserOrg(userId: string) {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { organization: true },
  });

  if (!membership) {
    throw apiError('No organisation found for this user', 404);
  }

  return membership.organization;
}

/**
 * Checks that `userId` is a member of `organizationId`.
 * Throws 403 if not a member.
 */
export async function requireOrgMembership(userId: string, organizationId: string) {
  const membership = await db.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });

  if (!membership) {
    throw apiError('Forbidden: not a member of this organisation', 403);
  }

  return membership;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Parses `data` against `schema` and returns the typed result.
 * Throws a 422 NextResponse containing field-level errors on failure.
 */
export function validateRequest<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = (result.error as ZodError).flatten().fieldErrors;
    throw NextResponse.json(
      { error: 'Validation error', errors },
      { status: 422 },
    );
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Creates a JSON error response.
 *
 * Can be `throw`n directly from route handlers — Next.js will NOT catch it
 * automatically, so wrap route logic in try/catch and return the thrown value.
 */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Creates a JSON success response (default status 200).
 */
export function apiSuccess(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Parses `page` and `limit` from a URLSearchParams or plain object.
 * Defaults: page=1, limit=20. Hard cap: limit <= 100.
 */
export function paginationParams(
  params: URLSearchParams | { get(key: string): string | null },
): PaginationOptions {
  const rawPage = parseInt(params.get('page') ?? '1', 10);
  const rawLimit = parseInt(params.get('limit') ?? '20', 10);

  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
