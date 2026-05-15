/**
 * GET    /api/knowledge-base/[kbId]  — knowledge base details
 * PATCH  /api/knowledge-base/[kbId]  — update knowledge base
 * DELETE /api/knowledge-base/[kbId]  — delete knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { KnowledgeBaseType, AgentType } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { kbId: string } };

async function findKb(kbId: string, organizationId: string) {
  return db.knowledgeBase.findFirst({
    where: { id: kbId, organizationId },
  });
}

// ---------------------------------------------------------------------------
// GET — knowledge base details
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const kb = await db.knowledgeBase.findFirst({
      where: { id: params.kbId, organizationId: org.id },
      include: {
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            size: true,
            chunkCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { documents: true } },
      },
    });

    if (!kb) return apiError('Knowledge base not found', 404);

    return apiSuccess({ knowledgeBase: kb });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/knowledge-base/[kbId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH — update knowledge base
// ---------------------------------------------------------------------------

const patchKbSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(KnowledgeBaseType).optional(),
  agentType: z.nativeEnum(AgentType).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findKb(params.kbId, org.id);
    if (!existing) return apiError('Knowledge base not found', 404);

    const body = await req.json();
    const input = validateRequest(patchKbSchema, body);

    const updated = await db.knowledgeBase.update({
      where: { id: params.kbId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.agentType !== undefined && { agentType: input.agentType }),
        ...(input.settings !== undefined && { settings: input.settings }),
      },
    });

    return apiSuccess({ knowledgeBase: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/knowledge-base/[kbId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete knowledge base
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findKb(params.kbId, org.id);
    if (!existing) return apiError('Knowledge base not found', 404);

    await db.knowledgeBase.delete({ where: { id: params.kbId } });

    return apiSuccess({ message: 'Knowledge base deleted' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/knowledge-base/[kbId]]', err);
    return apiError('Internal server error', 500);
  }
}
