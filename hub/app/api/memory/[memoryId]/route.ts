/**
 * PATCH  /api/memory/[memoryId]  — update memory (content, confidence, approved)
 * DELETE /api/memory/[memoryId]  — delete memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { MemoryType } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { memoryId: string } };

// ---------------------------------------------------------------------------
// PATCH — update memory
// ---------------------------------------------------------------------------

const patchMemorySchema = z.object({
  content: z.string().min(1).max(10_000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  approved: z.boolean().optional(),
  type: z.nativeEnum(MemoryType).optional(),
  tags: z.array(z.string().max(100)).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  summary: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await db.memory.findFirst({
      where: { id: params.memoryId, organizationId: org.id },
    });
    if (!existing) return apiError('Memory not found', 404);

    const body = await req.json();
    const input = validateRequest(patchMemorySchema, body);

    const updated = await db.memory.update({
      where: { id: params.memoryId },
      data: {
        ...(input.content !== undefined && { content: input.content }),
        ...(input.confidence !== undefined && { confidence: input.confidence }),
        ...(input.approved !== undefined && { approved: input.approved }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.expiresAt !== undefined && {
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        }),
        ...(input.summary !== undefined && { summary: input.summary }),
      },
    });

    return apiSuccess({ memory: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/memory/[memoryId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete memory
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await db.memory.findFirst({
      where: { id: params.memoryId, organizationId: org.id },
    });
    if (!existing) return apiError('Memory not found', 404);

    await db.memory.delete({ where: { id: params.memoryId } });

    return apiSuccess({ message: 'Memory deleted' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/memory/[memoryId]]', err);
    return apiError('Internal server error', 500);
  }
}
