/**
 * GET  /api/knowledge-base  — list knowledge bases
 * POST /api/knowledge-base  — create knowledge base
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
  paginationParams,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// GET — list knowledge bases
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);
    const typeFilter = sp.get('type') as KnowledgeBaseType | null;
    const agentTypeFilter = sp.get('agentType');

    const agentTypeValue = agentTypeFilter
      ? (agentTypeFilter.toUpperCase().replace(/-/g, '_') as AgentType)
      : undefined;

    const where = {
      organizationId: org.id,
      ...(typeFilter && { type: typeFilter }),
      ...(agentTypeValue && { agentType: agentTypeValue }),
    };

    const [knowledgeBases, total] = await Promise.all([
      db.knowledgeBase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { documents: true } },
        },
      }),
      db.knowledgeBase.count({ where }),
    ]);

    return apiSuccess({
      knowledgeBases,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/knowledge-base]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — create knowledge base
// ---------------------------------------------------------------------------

const createKbSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(KnowledgeBaseType).default(KnowledgeBaseType.GENERAL),
  agentType: z.nativeEnum(AgentType).optional(),
  settings: z.record(z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(createKbSchema, body);

    const kb = await db.knowledgeBase.create({
      data: {
        organizationId: org.id,
        name: input.name,
        description: input.description,
        type: input.type,
        agentType: input.agentType ?? null,
        settings: input.settings,
      },
    });

    return apiSuccess({ knowledgeBase: kb }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/knowledge-base]', err);
    return apiError('Internal server error', 500);
  }
}
