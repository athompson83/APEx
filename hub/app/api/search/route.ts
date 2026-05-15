/**
 * POST /api/search
 *
 * Global semantic search across all documents in the organisation.
 * Body: { query, organizationId?, limit?, agentType? }
 * Returns ranked results with citations.
 *
 * Falls back to keyword search; when pgvector embeddings are available the
 * cosine-similarity query can replace the ILIKE WHERE clause below.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType, DocumentStatus } from '@/lib/db';
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

const searchSchema = z.object({
  query: z.string().min(1).max(2000),
  /** Explicit org override — defaults to the caller's primary org */
  organizationId: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  agentType: z.nativeEnum(AgentType).optional(),
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const primaryOrg = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(searchSchema, body);

    // Resolve target org — if caller specifies one, verify membership
    let organizationId = primaryOrg.id;
    if (input.organizationId && input.organizationId !== primaryOrg.id) {
      const member = await db.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: input.organizationId,
          },
        },
      });
      if (!member) return apiError('Forbidden: not a member of the requested organisation', 403);
      organizationId = input.organizationId;
    }

    // ── Keyword search on document chunks ────────────────────────────────────
    // TODO: replace with pgvector cosine similarity once embeddings are set up:
    //   SELECT dc.*, 1 - (dc.embedding <=> $queryEmbedding) AS similarity
    //   FROM document_chunks dc
    //   WHERE dc.organization_id = $orgId
    //   ORDER BY similarity DESC LIMIT $limit
    const chunks = await db.documentChunk.findMany({
      where: {
        organizationId,
        content: { contains: input.query, mode: 'insensitive' },
        document: {
          status: DocumentStatus.READY,
          ...(input.agentType && {
            knowledgeBase: { agentType: input.agentType },
          }),
        },
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            type: true,
            knowledgeBaseId: true,
            summary: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: input.limit,
    });

    // Build ranked results with citations
    const results = chunks.map((chunk, index) => ({
      rank: index + 1,
      score: 1.0, // placeholder — will be cosine similarity score
      documentId: chunk.document.id,
      documentName: chunk.document.name,
      documentType: chunk.document.type,
      knowledgeBaseId: chunk.document.knowledgeBaseId,
      excerpt: chunk.content.slice(0, 500),
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      metadata: chunk.metadata,
    }));

    return apiSuccess({
      query: input.query,
      organizationId,
      results,
      total: results.length,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/search]', err);
    return apiError('Internal server error', 500);
  }
}
