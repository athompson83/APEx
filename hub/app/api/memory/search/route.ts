/**
 * POST /api/memory/search
 *
 * Semantic search across memories.
 * Body: { query, agentType?, limit? }
 *
 * When pgvector embeddings are available this will perform a cosine-similarity
 * search; until then it falls back to a keyword (ILIKE) search on content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const searchMemorySchema = z.object({
  query: z.string().min(1).max(2000),
  agentType: z.nativeEnum(AgentType).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(searchMemorySchema, body);

    // ── Keyword fallback (pgvector similarity to be added when embeddings exist)
    const memories = await db.memory.findMany({
      where: {
        organizationId: org.id,
        approved: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(input.agentType && {
          OR: [{ agentType: input.agentType }, { agentType: null }],
        }),
        content: { contains: input.query, mode: 'insensitive' },
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
    });

    return apiSuccess({
      query: input.query,
      results: memories,
      total: memories.length,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/memory/search]', err);
    return apiError('Internal server error', 500);
  }
}
