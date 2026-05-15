/**
 * GET   /api/documents/[documentId]  — document details + chunks summary
 * DELETE /api/documents/[documentId] — delete document + chunks
 * PATCH /api/documents/[documentId]  — update tags, knowledgeBaseId
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { deleteFile } from '@/lib/storage';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { documentId: string } };

async function findDocument(documentId: string, organizationId: string) {
  return db.document.findFirst({
    where: { id: documentId, organizationId },
  });
}

// ---------------------------------------------------------------------------
// GET — document details + chunks summary
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const document = await db.document.findFirst({
      where: { id: params.documentId, organizationId: org.id },
      include: {
        knowledgeBase: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            tokenCount: true,
            metadata: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) return apiError('Document not found', 404);

    // Summarise chunks instead of returning all content
    const chunksSummary = {
      count: document.chunks.length,
      totalTokens: document.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      chunks: document.chunks.map(({ id, chunkIndex, tokenCount, metadata }) => ({
        id,
        chunkIndex,
        tokenCount,
        metadata,
      })),
    };

    return apiSuccess({ document: { ...document, chunks: undefined }, chunksSummary });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/documents/[documentId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH — update tags / knowledgeBaseId
// ---------------------------------------------------------------------------

const patchDocumentSchema = z.object({
  tags: z.array(z.string().max(100)).optional(),
  knowledgeBaseId: z.string().cuid().nullable().optional(),
  name: z.string().min(1).max(500).optional(),
  summary: z.string().max(5000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findDocument(params.documentId, org.id);
    if (!existing) return apiError('Document not found', 404);

    const body = await req.json();
    const input = validateRequest(patchDocumentSchema, body);

    // Validate knowledge base if changing
    if (input.knowledgeBaseId) {
      const kb = await db.knowledgeBase.findFirst({
        where: { id: input.knowledgeBaseId, organizationId: org.id },
      });
      if (!kb) return apiError('Knowledge base not found', 404);
    }

    const updated = await db.document.update({
      where: { id: params.documentId },
      data: {
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.knowledgeBaseId !== undefined && { knowledgeBaseId: input.knowledgeBaseId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.summary !== undefined && { summary: input.summary }),
      },
    });

    return apiSuccess({ document: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/documents/[documentId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete document + chunks + storage
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findDocument(params.documentId, org.id);
    if (!existing) return apiError('Document not found', 404);

    // Delete storage file (non-fatal if missing)
    try {
      await deleteFile(existing.storageKey);
    } catch {
      // Storage file already gone — continue
    }

    // Cascade deletes chunks via Prisma relation
    await db.document.delete({ where: { id: params.documentId } });

    return apiSuccess({ message: 'Document deleted' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/documents/[documentId]]', err);
    return apiError('Internal server error', 500);
  }
}
