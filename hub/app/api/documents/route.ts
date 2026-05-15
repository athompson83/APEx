/**
 * GET  /api/documents  — list documents with filters
 * POST /api/documents  — handle file upload with multipart form data
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { DocumentStatus, DocumentType } from '@/lib/db';
import { saveFile } from '@/lib/storage';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
  paginationParams,
} from '@/lib/api/helpers';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const MIME_TO_DOC_TYPE: Record<string, DocumentType> = {
  'application/pdf': DocumentType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.DOCX,
  'application/msword': DocumentType.DOCX,
  'text/plain': DocumentType.TXT,
  'text/markdown': DocumentType.MARKDOWN,
  'text/csv': DocumentType.CSV,
  'application/json': DocumentType.JSON,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentType.SPREADSHEET,
  'application/vnd.ms-excel': DocumentType.SPREADSHEET,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': DocumentType.SLIDE_DECK,
};

// ---------------------------------------------------------------------------
// GET — list documents
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);

    const statusFilter = sp.get('status') as DocumentStatus | null;
    const typeFilter = sp.get('type') as DocumentType | null;
    const kbFilter = sp.get('knowledgeBaseId');
    const searchQuery = sp.get('q');

    const where = {
      organizationId: org.id,
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { type: typeFilter }),
      ...(kbFilter && { knowledgeBaseId: kbFilter }),
      ...(searchQuery && {
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' as const } },
          { summary: { contains: searchQuery, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          mimeType: true,
          size: true,
          status: true,
          summary: true,
          tags: true,
          chunkCount: true,
          knowledgeBaseId: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.document.count({ where }),
    ]);

    return apiSuccess({
      documents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/documents]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — file upload + queue processing
// ---------------------------------------------------------------------------

const uploadMetaSchema = z.object({
  knowledgeBaseId: z.string().cuid().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return apiError('No file provided', 400);
    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
    }

    const mimeType = file.type || 'application/octet-stream';
    const docType = MIME_TO_DOC_TYPE[mimeType] ?? DocumentType.TXT;

    // Parse optional metadata
    const rawMeta = formData.get('metadata');
    const meta = uploadMetaSchema.safeParse(
      rawMeta ? JSON.parse(rawMeta as string) : {},
    );
    const { knowledgeBaseId, tags } = meta.success ? meta.data : {};

    // Validate knowledgeBase ownership if provided
    if (knowledgeBaseId) {
      const kb = await db.knowledgeBase.findFirst({
        where: { id: knowledgeBaseId, organizationId: org.id },
      });
      if (!kb) return apiError('Knowledge base not found', 404);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await saveFile(buffer, file.name, mimeType);

    const document = await db.document.create({
      data: {
        organizationId: org.id,
        userId: session.user.id,
        knowledgeBaseId: knowledgeBaseId ?? null,
        name: file.name,
        type: docType,
        mimeType,
        size: file.size,
        storageKey,
        status: DocumentStatus.PENDING,
        tags: tags ?? [],
      },
    });

    // TODO: Enqueue processing job via BullMQ
    // await documentQueue.add('process', { documentId: document.id });

    return apiSuccess({ document }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/documents]', err);
    return apiError('Internal server error', 500);
  }
}
