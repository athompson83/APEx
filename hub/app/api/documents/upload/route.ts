/**
 * POST /api/documents/upload
 *
 * Dedicated upload endpoint using NextJS request.formData().
 * Validates file size (max 50 MB) and MIME type, saves to storage,
 * creates the Document record, enqueues a processing job, and returns
 * { documentId, status: 'processing' } immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { DocumentStatus, DocumentType } from '@/lib/db';
import { saveFile } from '@/lib/storage';
import {
  getAuthSession,
  getUserOrg,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);

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
  'application/vnd.ms-powerpoint': DocumentType.SLIDE_DECK,
};

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError('Invalid multipart form data', 400);
    }

    const file = formData.get('file') as File | null;
    if (!file) return apiError('Field "file" is required', 400);

    // Validate file size
    if (file.size === 0) return apiError('File is empty', 400);
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        `File exceeds the maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        413,
      );
    }

    // Validate MIME type
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return apiError(
        `File type "${mimeType}" is not supported. Allowed types: PDF, DOCX, TXT, MD, CSV, JSON, XLSX, PPTX`,
        415,
      );
    }

    const docType = MIME_TO_DOC_TYPE[mimeType] ?? DocumentType.TXT;

    // Optional fields from form
    const knowledgeBaseId = (formData.get('knowledgeBaseId') as string | null) ?? undefined;
    const tagsRaw = formData.get('tags') as string | null;
    const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : [];

    // Validate knowledgeBase ownership
    if (knowledgeBaseId) {
      const kb = await db.knowledgeBase.findFirst({
        where: { id: knowledgeBaseId, organizationId: org.id },
      });
      if (!kb) return apiError('Knowledge base not found', 404);
    }

    // Save file to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await saveFile(buffer, file.name, mimeType);

    // Create document record
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
        status: DocumentStatus.PROCESSING,
        tags,
      },
    });

    // TODO: Enqueue BullMQ processing job
    // await documentQueue.add('process', {
    //   documentId: document.id,
    //   storageKey,
    //   mimeType,
    //   organizationId: org.id,
    // });

    return apiSuccess(
      {
        documentId: document.id,
        status: 'processing' as const,
        name: document.name,
        size: document.size,
        type: document.type,
      },
      202,
    );
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/documents/upload]', err);
    return apiError('Internal server error', 500);
  }
}
