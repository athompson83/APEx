/**
 * GET   /api/organizations  — current org details
 * PATCH /api/organizations  — update org settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// GET — current org details
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const full = await db.organization.findUnique({
      where: { id: org.id },
      include: {
        _count: {
          select: {
            members: true,
            agents: true,
            documents: true,
            workflows: true,
            memories: true,
          },
        },
      },
    });

    if (!full) return apiError('Organisation not found', 404);

    // Retrieve the caller's membership role
    const membership = await db.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: session.user.id, organizationId: org.id },
      },
      select: { role: true },
    });

    return apiSuccess({ organization: full, role: membership?.role ?? null });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/organizations]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH — update org settings
// ---------------------------------------------------------------------------

const patchOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    // Only OWNER/ADMIN can update org settings
    const membership = await db.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: session.user.id, organizationId: org.id },
      },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return apiError('Forbidden: insufficient permissions', 403);
    }

    const body = await req.json();
    const input = validateRequest(patchOrgSchema, body);

    const updated = await db.organization.update({
      where: { id: org.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.settings !== undefined && { settings: input.settings }),
      },
    });

    return apiSuccess({ organization: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/organizations]', err);
    return apiError('Internal server error', 500);
  }
}
