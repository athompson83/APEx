/**
 * GET  /api/memory  — list memories (agentType filter, search)
 * POST /api/memory  — create memory manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType, MemoryType } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
  paginationParams,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// GET — list memories
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);

    const agentTypeFilter = sp.get('agentType');
    const searchQuery = sp.get('q');
    const approvedFilter = sp.get('approved');
    const typeFilter = sp.get('type') as MemoryType | null;

    const agentTypeValue = agentTypeFilter
      ? (agentTypeFilter.toUpperCase().replace(/-/g, '_') as AgentType)
      : undefined;

    const where = {
      organizationId: org.id,
      ...(agentTypeValue && { agentType: agentTypeValue }),
      ...(typeFilter && { type: typeFilter }),
      ...(approvedFilter !== null && { approved: approvedFilter === 'true' }),
      ...(searchQuery && {
        content: { contains: searchQuery, mode: 'insensitive' as const },
      }),
      // Filter out expired memories
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [memories, total] = await Promise.all([
      db.memory.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.memory.count({ where }),
    ]);

    return apiSuccess({
      memories,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/memory]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — create memory manually
// ---------------------------------------------------------------------------

const createMemorySchema = z.object({
  content: z.string().min(1).max(10_000),
  type: z.nativeEnum(MemoryType),
  agentType: z.nativeEnum(AgentType).optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  tags: z.array(z.string().max(100)).default([]),
  expiresAt: z.string().datetime().optional(),
  approved: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(createMemorySchema, body);

    const memory = await db.memory.create({
      data: {
        organizationId: org.id,
        content: input.content,
        type: input.type,
        agentType: input.agentType ?? null,
        confidence: input.confidence,
        tags: input.tags,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        approved: input.approved,
      },
    });

    return apiSuccess({ memory }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/memory]', err);
    return apiError('Internal server error', 500);
  }
}
